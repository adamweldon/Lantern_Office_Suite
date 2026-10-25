#!/bin/sh
# setup-kit.sh -- fetch the AI engine (llama.cpp) and models into this kit.
# Needs internet once; afterwards the kit works offline and can be copied.
#   ./setup-kit.sh              Lantern itself when the kit lacks it (from GitHub), then
#                               engine + the 4B model, then offers a bigger model
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
#   ./setup-kit.sh vision       the vision part of every laptop model in the kit
#                               (mmproj, 0.7-0.9 GB each): the AI can then look at
#                               the drawings it makes. New 4B/9B/35B downloads
#                               bring theirs along.
#   ./setup-kit.sh check        what this computer can run and what the kit has
#   ./setup-kit.sh build-engine build llama-server on this computer from source
#                               (when the ready-made one cannot start here, e.g.
#                               Raspberry Pi OS Bookworm: older system libraries);
#                               setup offers this by itself. Needs a C++ compiler;
#                               cmake is fetched with pip when it is missing.
#   ./setup-kit.sh lantern      the newest Lantern from GitHub into the kit (site/),
#                               also to update it; setup fetches it by itself when
#                               neither kit/site nor the repository's site/ is there
#   ./setup-kit.sh info         key=value facts for the installer window
#   add "gpu" for the Vulkan engine builds (graphics card) on Windows/Linux
# Double-click set-up: "Install Lantern (Linux).desktop" / "Install Lantern
# (Mac).command" run this with popups instead of typed answers:
#   LANTERN_UI=1      the installer window (kit/lantern-kit.py) shows the steps
#                     and asks the questions: @@ lines on stderr, answers on stdin
#   LANTERN_POPUP=zenity|kdialog|osascript   questions pop up as dialogs while
#                     the terminal window shows the progress
# start-lantern.sh runs "setup-kit.sh offer": when this computer can run a
# bigger model than the kit has, and there is room and internet, it asks once
# and downloads it in the background while Lantern starts.
# Overrides: LLAMA_BUILD (default b11435), LLAMA_BASE, LLAMA_SRC, HF_BASE, KIWIX_BASE (mirrors);
# LANTERN_SRC (Lantern's own archive, default the GitHub repository's main branch);
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
LLAMA_SRC="${LLAMA_SRC:-https://github.com/ggml-org/llama.cpp/archive/refs/tags/$BUILD.tar.gz}"
LANTERN_SRC="${LANTERN_SRC:-https://github.com/adamweldon/Lantern_Office_Suite/archive/refs/heads/main.tar.gz}"
LANTERN_HOME="https://github.com/adamweldon/Lantern_Office_Suite"

# The installer window (LANTERN_UI=1) follows along by @@ lines on stderr:
# STEP id text, GET file, ASK kind title + Q lines + END (answer on stdin).
ui() { if [ -n "${LANTERN_UI:-}" ]; then printf '@@%s\n' "$*" >&2; fi; return 0; }
# q: a line of the question that ask() asks next (shown in its popup too).
QTEXT=""
q() { echo "$1"; QTEXT="$QTEXT$1
"; }

fetch() {  # url dest -- resumes an interrupted download. Fails, keeping the .part to
  # carry on from next time, when it stops: callers check (set -e does not hold in
  # functions called from && or ||, so a stopped download was once kept as whole).
  if [ -s "$2" ]; then echo "  have $(basename "$2")"; return 0; fi
  if [ -s "$2.part" ]; then echo "  downloading $(basename "$2") (resuming where it stopped)"
  else echo "  downloading $(basename "$2")"; fi
  ui "GET $(basename "$2")"
  tries=0
  while :; do
    if [ -n "${LANTERN_UI:-}" ]; then   # curl's own meter: the window shows size, speed and time left
      curl -L --fail --retry 3 -C - -o "$2.part" "$1" && break
    else
      curl -L --fail --retry 3 -C - --progress-bar -o "$2.part" "$1" && break
    fi
    rc=$?; tries=$((tries + 1))
    case $rc in
      18|28|52|55|56|92) ;;          # only a transfer that broke off is tried again ...
      33) rm -f "$2.part" ;;         # ... from the start when the server cannot carry on
      *) return $rc ;;
    esac
    if [ $tries -ge 3 ]; then echo "  $(basename "$2") stopped downloading; setup carries on from there next time"; return $rc; fi
    echo "  the download of $(basename "$2") broke off; carrying on from where it stopped"
    sleep 3
  done
  mv "$2.part" "$2"
}
model() {  # repo file
  fetch "$HF_BASE/$1/resolve/main/$2" "$MODELS/$2" || return 1
  if [ "$(head -c 4 "$MODELS/$2")" != "GGUF" ]; then echo "  $2 is not a GGUF file; deleted"; rm -f "$MODELS/$2"; return 1; fi
}
engine() {  # os asset
  if [ -x "$DIR/engine/$1/llama-server" ] || [ -f "$DIR/engine/$1/llama-server.exe" ]; then echo "  have engine for $1"; return 0; fi
  tmp=$(mktemp -d)
  fetch "$LLAMA_BASE/$2" "$tmp/$2" || { rm -rf "$tmp"; ui "FAIL net"; return 1; }
  case "$2" in
    *.zip) (cd "$tmp" && unzip -q "$2") || { echo "  $2 is damaged"; rm -rf "$tmp"; return 1; } ;;
    *) tar -xzf "$tmp/$2" -C "$tmp" || { echo "  $2 is damaged"; rm -rf "$tmp"; return 1; } ;;
  esac
  bin=$(find "$tmp" -type f \( -name llama-server -o -name llama-server.exe \) | head -n 1)
  if [ -z "$bin" ]; then echo "  no llama-server inside $2"; rm -rf "$tmp"; return 1; fi
  mkdir -p "$DIR/engine/$1"
  # -L: the libraries' symlinks become plain files -- exFAT sticks cannot hold symlinks
  cp -RL "$(dirname "$bin")"/. "$DIR/engine/$1/"
  chmod +x "$DIR/engine/$1/"llama-* 2>/dev/null || true
  rm -rf "$tmp"
  echo "  engine for $1 ready"
}
# --- Lantern itself (the site/ folder llama-server serves) -----------------------
# site_dir -- the Lantern this kit starts: kit/site, else the repository's site/
# beside kit/ (the zip from GitHub); nothing when neither is there.
site_dir() {
  for d in "$DIR/site" "$DIR/../site"; do
    if [ -f "$d/index.html" ]; then (cd "$d" && pwd); return 0; fi
  done
  return 0
}
lantern_version() {  # site -- the version it says it is, or nothing
  if [ -f "$1/lantern-version.txt" ]; then head -n 1 "$1/lantern-version.txt"; return 0; fi
  if [ -f "$1/../package.json" ]; then sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$1/../package.json" | head -n 1; fi
  return 0
}
# get_lantern [new] -- Lantern into kit/site from GitHub when the kit has none
# ("new": always, the newest -- also an update). The one in use stays until the
# new one is in place and checked.
get_lantern() {
  cur=$(site_dir)
  if [ -n "$cur" ] && [ "${1:-}" != new ]; then
    v=$(lantern_version "$cur"); echo "  have Lantern${v:+ $v} ($cur)"; return 0
  fi
  ui "STEP lantern Getting Lantern itself"
  echo "  Lantern itself (the suite: about 10 MB) from $LANTERN_HOME"
  tmp=$(mktemp -d)
  if ! fetch "$LANTERN_SRC" "$tmp/lantern.tar.gz"; then
    echo "  Could not download Lantern. Check the internet connection and run setup again,"
    echo "  or download the zip from $LANTERN_HOME and run Install Lantern from inside it."
    rm -rf "$tmp"; ui "FAIL net"; return 1
  fi
  mkdir "$tmp/x"
  if ! tar -xzf "$tmp/lantern.tar.gz" -C "$tmp/x"; then echo "  the Lantern download is damaged; run setup again"; rm -rf "$tmp"; ui "FAIL net"; return 1; fi
  top=$(find "$tmp/x" -mindepth 1 -maxdepth 1 -type d | head -n 1)
  if [ -z "$top" ] || [ ! -f "$top/site/index.html" ] || ! grep -q "Lantern" "$top/site/index.html"; then
    echo "  the download has no Lantern in it (site/index.html)"; rm -rf "$tmp"; ui "FAIL net"; return 1
  fi
  v=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$top/package.json" 2>/dev/null | head -n 1)
  echo "${v:-unknown} (from $LANTERN_HOME, $(date +%Y-%m-%d))" > "$top/site/lantern-version.txt"
  rm -rf "$DIR/site.new" "$DIR/site.old"
  if ! cp -RL "$top/site" "$DIR/site.new"; then echo "  could not copy Lantern into $DIR"; rm -rf "$tmp" "$DIR/site.new"; ui "FAIL copy"; return 1; fi
  if [ -d "$DIR/site" ]; then mv "$DIR/site" "$DIR/site.old"; fi
  mv "$DIR/site.new" "$DIR/site"
  rm -rf "$DIR/site.old" "$tmp"
  echo "  Lantern${v:+ $v} is in the kit ($DIR/site)"
}

# engine_dir os -- this computer's engine folder: engine/<os>; on Linux
# engine/linux-<cpu> instead when engine/linux holds programs for another kind
# of CPU (a stick shared by a laptop and a Raspberry Pi keeps both).
engine_dir() {
  if [ "$1" != linux ]; then echo "$1"; return 0; fi
  a="linux-$(uname -m)"
  if [ -e "$DIR/engine/$a/llama-server" ] || [ -e "$DIR/engine/$a/kiwix/kiwix-serve" ]; then echo "$a"; return 0; fi
  for f in "$DIR/engine/linux/llama-server" "$DIR/engine/linux/kiwix/kiwix-serve"; do
    if [ -f "$f" ] && ! this_cpu "$f"; then echo "$a"; return 0; fi
  done
  echo linux
}
this_cpu() {  # file -- false only for a program (ELF) made for another kind of CPU
  [ "$(head -c 4 "$1" 2>/dev/null | od -An -c | tr -d ' \n')" = "177ELF" ] || return 0
  m=$(od -An -tx1 -j18 -N2 "$1" 2>/dev/null | tr -d ' \n')
  case "$(uname -m)" in
    x86_64|amd64) [ "$m" = 3e00 ] ;;
    aarch64|arm64) [ "$m" = b700 ] || [ "$m" = 2800 ] ;;   # 32-bit Raspberry Pi OS on a 64-bit kernel runs 32-bit ones
    armv*) [ "$m" = 2800 ] ;;
    *) return 0 ;;
  esac
}
# engine_fault folder -- prints "ok" when the kit's engine starts on this
# computer (asked with --version, which exits at once), else why it does not.
engine_fault() {
  d="$DIR/engine/$1"
  [ -f "$d/llama-server" ] || { echo "it is not in the kit"; return 0; }
  chmod +x "$d/llama-server" 2>/dev/null || true
  if out=$(cd "$d" && LD_LIBRARY_PATH="$d${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" DYLD_LIBRARY_PATH="$d${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}" \
           ./llama-server --version 2>&1); then echo ok; return 0; fi
  line=$(printf '%s\n' "$out" | grep -m 1 -E "GLIBC|GLIBCXX|not found|No such file|Exec format|Permission denied|cannot execute" || true)
  [ -n "$line" ] || line=$(printf '%s\n' "$out" | grep -v '^ *$' | tail -n 1 || true)
  echo "${line:-it stopped at once}"
}
# engine_ready -- setup: the engine must start here. When the ready-made one
# cannot (Raspberry Pi OS Bookworm and other older systems lack the newer
# system libraries it was built against), offer to build one on this computer.
engine_ready() {
  why=$(engine_fault "$ENGD") || why="it could not be checked"
  if [ "$why" = ok ]; then echo "  the engine starts on this computer"; return 0; fi
  echo ""
  q "  The AI engine does not start on this computer: $why"
  case "$why" in
    *GLIBC*) q "  It was made for newer Linux systems than this one (Raspberry Pi OS Bookworm, Ubuntu 22.04 and older)." ;;
    *"Permission denied"*) if fs_type | grep -qiE '^(msdos|vfat|fat)'; then
      q "  This drive is FAT32, and Linux cannot start programs from a FAT32 drive."
      q "  Reformat the stick as exFAT, or copy the Lantern folder onto this computer, then set up again."
      ui "FAIL fat32"; return 1; fi ;;
  esac
  if [ "$OS" != linux ]; then ui "FAIL engine"; return 1; fi
  q "  Lantern can build the engine on this computer instead. That takes about 10 to 20 minutes"
  q "  on a Raspberry Pi 5 (less on most laptops) and about 1 GB of space while it builds."
  ans=$(ask build "Build the AI engine on this computer"); QTEXT=""
  if [ "$ans" != yes ]; then echo "  Not built. To build it later: ./setup-kit.sh build-engine"; ui "FAIL engine"; return 1; fi
  build_engine
}
# build_engine -- compile llama-server (llama.cpp $BUILD, the same version the
# ready-made engines are) on this computer and put it in engine/linux/. One
# static program, so nothing else is needed next to it.
build_engine() {
  ui "STEP build Building the AI engine on this computer"
  for t in cc c++ make; do
    if ! command -v $t >/dev/null 2>&1; then
      echo "  Cannot build: '$t' is missing. Install the build tools first (Debian, Ubuntu, Raspberry Pi OS:"
      echo "  sudo apt install build-essential), then run ./setup-kit.sh build-engine"; ui "FAIL tools"; return 1
    fi
  done
  B="${LANTERN_BUILD_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/lantern-build}"   # on this computer: a stick may not hold symlinks
  mkdir -p "$B" || { echo "  cannot make the build folder $B"; ui "FAIL build"; return 1; }
  CMAKE=$(command -v cmake 2>/dev/null || true)
  if [ -z "$CMAKE" ] && [ -x "$B/venv/bin/cmake" ]; then CMAKE="$B/venv/bin/cmake"; fi
  if [ -z "$CMAKE" ]; then
    echo "  getting cmake (the build tool) with pip"
    if ! { python3 -m venv "$B/venv" && "$B/venv/bin/pip" install --disable-pip-version-check -q cmake; }; then
      echo "  Could not get cmake. Install it (sudo apt install cmake), then run ./setup-kit.sh build-engine"; ui "FAIL tools"; return 1
    fi
    CMAKE="$B/venv/bin/cmake"
  fi
  src="$B/llama.cpp-$BUILD"
  if [ ! -f "$src/CMakeLists.txt" ]; then
    rm -f "$B/source.tar.gz.part"   # source archives do not resume
    fetch "$LLAMA_SRC" "$B/source.tar.gz" || { echo "  could not download the llama.cpp source"; ui "FAIL net"; return 1; }
    rm -rf "$src.unpack"; mkdir -p "$src.unpack"
    tar -xzf "$B/source.tar.gz" -C "$src.unpack"
    top=$(find "$src.unpack" -mindepth 1 -maxdepth 1 -type d | head -n 1)
    if [ -z "$top" ] || [ ! -f "$top/CMakeLists.txt" ]; then echo "  the llama.cpp source archive is not what was expected"; rm -rf "$src.unpack" "$B/source.tar.gz"; ui "FAIL source"; return 1; fi
    mv "$top" "$src"; rm -rf "$src.unpack" "$B/source.tar.gz"
  fi
  # one compile job per CPU core, but each of llama.cpp's big files can take
  # nearly 2 GB to compile, and the desktop needs its share
  cores=$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 2)
  jobs=$(awk -v c="$cores" -v m="$(mem_mb)" 'BEGIN { j = int((m - 1000) / 1800); if (j > c) j = c; if (j < 1) j = 1; print j }')
  echo "  building llama-server with $jobs of $cores cores (the percentage is the build's own)"
  "$CMAKE" -S "$src" -B "$src/build" -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DGGML_NATIVE=ON \
    -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF -DLLAMA_BUILD_APP=OFF -DLLAMA_OPENSSL=OFF \
    -DLLAMA_BUILD_UI=OFF -DLLAMA_USE_PREBUILT_UI=OFF -DGGML_CCACHE=OFF > "$B/configure.log" 2>&1 ||
    { tail -n 20 "$B/configure.log"; echo "  the build could not start (log: $B/configure.log)"; ui "FAIL build"; return 1; }
  "$CMAKE" --build "$src/build" --config Release --target llama-server -j "$jobs" ||
    { echo "  the build stopped. Run ./setup-kit.sh build-engine to try again (it carries on where it stopped)."; ui "FAIL build"; return 1; }
  bin="$src/build/bin/llama-server"
  if ! "$bin" --version >/dev/null 2>&1; then echo "  the engine was built but does not start"; ui "FAIL build"; return 1; fi
  d="$DIR/engine/$ENGD"; mkdir -p "$d"
  find "$d" -maxdepth 1 \( -type f -o -type l \) -exec rm -f {} +   # the ready-made engine; kiwix/ stays
  if ! { cp "$bin" "$d/llama-server" && chmod +x "$d/llama-server"; }; then echo "  could not copy the engine into $d"; ui "FAIL build"; return 1; fi
  echo "llama.cpp $BUILD, built on this computer ($(uname -m), $(date +%Y-%m-%d))" > "$d/BUILT-HERE.txt"
  rm -rf "$src" "$B/venv" "$B/configure.log"; rmdir "$B" 2>/dev/null || true   # only what the build made
  echo "  engine built for this computer"
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
# The model's vision part: mmproj-F16.gguf in its repository, kept as
# mmproj-<model>-F16.gguf (start-lantern loads it with that model). Laptop
# models only; a failed download is reported, not fatal.
vision_file() { echo "mmproj-$(basename "$T_REPO" | sed 's/-GGUF$//')-F16.gguf"; }
get_vision() {
  case "$T_ID" in xl|big|laptop) ;; *) return 0 ;; esac
  vf=$(vision_file)
  if ! fetch "$HF_BASE/$T_REPO/resolve/main/mmproj-F16.gguf" "$MODELS/$vf"; then echo "  (vision part of $T_NAME not downloaded)"; return 0; fi
  if [ "$(head -c 4 "$MODELS/$vf")" != "GGUF" ]; then echo "  $vf is not a GGUF file; deleted"; rm -f "$MODELS/$vf"; fi
  return 0
}
get_tier() { tier "$1" && model "$T_REPO" "$T_FILE" && { have "$T_PAT" && get_vision; return 0; }; }
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
  kt="$DIR/engine/$ENGD/kiwix"
  if [ -x "$kt/kiwix-serve" ]; then echo "  have kiwix-serve"; return 0; fi
  plat=$(kiwix_plat); list=$(listing "$KIWIX_BASE/release/kiwix-tools/") || { echo "  could not list $KIWIX_BASE/release/kiwix-tools/"; return 1; }
  asset=$(printf '%s' "$list" | grep -o "href=\"[^\"]*kiwix-tools_$plat-[0-9][0-9.-]*\.tar\.gz\"" | sed 's/^href="//; s/"$//; s#.*/##' | sort -u | sort -V | tail -n 1)
  if [ -z "$asset" ] && [ "$plat" = macos-arm64 ]; then
    asset=$(printf '%s' "$list" | grep -o "href=\"[^\"]*kiwix-tools_macos-x86_64-[0-9][0-9.-]*\.tar\.gz\"" | sed 's/^href="//; s/"$//; s#.*/##' | sort -u | sort -V | tail -n 1)
  fi
  if [ -z "$asset" ]; then echo "  no kiwix-tools for $plat at $KIWIX_BASE/release/kiwix-tools/"; return 1; fi
  tmp=$(mktemp -d)
  fetch "$KIWIX_BASE/release/kiwix-tools/$asset" "$tmp/$asset" || { rm -rf "$tmp"; return 1; }
  tar -xzf "$tmp/$asset" -C "$tmp" || { echo "  $asset is damaged"; rm -rf "$tmp"; return 1; }
  bin=$(find "$tmp" -type f -name kiwix-serve | head -n 1)
  if [ -z "$bin" ]; then echo "  no kiwix-serve inside $asset"; rm -rf "$tmp"; return 1; fi
  mkdir -p "$kt"; cp -R "$(dirname "$bin")"/. "$kt/"; chmod +x "$kt"/kiwix-* 2>/dev/null || true
  rm -rf "$tmp"
  echo "  kiwix-serve ready ($asset)"
}
get_zim() {  # url -- into library/, checked against the published SHA-256
  mkdir -p "$LIBRARY"; f=$(basename "$1"); dest="$LIBRARY/$f"; fresh=1
  [ -s "$dest" ] && fresh=""
  fetch "$1" "$dest" || return 1
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
ask() {  # [kind] [title] -- prints yes / no / nothing (no keyboard). The
  # question is the q lines printed just before. Kinds: "optin" a very large
  # download -- only Y says yes; no answer means not now (asked next time);
  # "build" build the engine here (N is not remembered).
  if [ "${LANTERN_AUTO_DOWNLOAD:-}" = 1 ]; then echo yes; return; fi
  if [ -n "${LANTERN_UI:-}" ]; then   # the installer window asks; its buttons send y, n or nothing
    { echo "@@ASK ${1:-ask} ${2:-Lantern}"; printf '%s' "$QTEXT" | sed 's/^/@@Q /'; echo "@@END"; } >&2
    a=""; read -r a || true
    case "$a" in n*|N*) echo no ;; y*|Y*) echo yes ;; esac
    return
  fi
  if [ -n "${LANTERN_POPUP:-}" ] && a=$(popup_ask "${1:-}" "${2:-Lantern}"); then [ -z "$a" ] || echo "$a"; return; fi
  if [ ! -t 0 ]; then echo "  (no keyboard here, so not now)" >&2; return; fi
  if [ "${1:-}" = optin ]; then d="not now"; else d="yes"; fi
  if [ "${1:-}" = build ]; then printf "  Build it now?  Y = yes   N = no   (yes in 30 s) " >&2
  else printf "  Download it now?  Y = yes   N = no, and don't ask again   (%s in 30 s) " "$d" >&2; fi
  if command -v bash >/dev/null 2>&1; then a=$(bash -c 'read -r -t 30 a; echo "$a"'); else read -r a; fi
  case "$a" in n*|N*) echo no ;; y*|Y*) echo yes ;; *) [ "${1:-}" = optin ] || echo yes ;; esac
}
# popup_ask kind title -- the question as a dialog (zenity, kdialog or, on a
# Mac, osascript): prints yes / no / nothing (not now); fails when no dialog
# could be shown, and the question is then asked in the terminal instead.
popup_ask() {
  # It runs in $(...), where set -e still holds: each dialog's status is caught with || r=$?
  msg=$(printf '%s' "$QTEXT" | sed 's/^ *//' | awk 'BEGIN { ORS = "" } NR > 1 { print " " } { print }')
  yes="Download it"; no="No, don't ask again"
  if [ "$1" = build ]; then yes="Build it"; no=""; fi
  case "$LANTERN_POPUP" in
    zenity)
      command -v zenity >/dev/null 2>&1 || return 1
      if [ -n "$no" ]; then
        r=0; a=$(zenity --question --title="$2" --width=460 --no-markup --text="$msg" --ok-label="$yes" --cancel-label="Not now" --extra-button="$no" 2>/dev/null) || r=$?
      else
        r=0; a=$(zenity --question --title="$2" --width=460 --no-markup --text="$msg" --ok-label="$yes" --cancel-label="Not now" 2>/dev/null) || r=$?
      fi
      if [ -n "$no" ] && [ "$a" = "$no" ]; then echo no; return 0; fi
      case $r in 0) echo yes ;; 1) ;; *) return 1 ;; esac; return 0 ;;
    kdialog)
      command -v kdialog >/dev/null 2>&1 || return 1
      r=0
      if [ -n "$no" ]; then kdialog --title "$2" --yesnocancel "$msg" --yes-label "$yes" --no-label "$no" --cancel-label "Not now" >/dev/null 2>&1 || r=$?
      else kdialog --title "$2" --yesno "$msg" --yes-label "$yes" --no-label "Not now" >/dev/null 2>&1 || r=$?; if [ $r -eq 1 ]; then r=2; fi; fi
      case $r in 0) echo yes ;; 1) echo no ;; 2) ;; *) return 1 ;; esac; return 0 ;;
    osascript)
      command -v osascript >/dev/null 2>&1 || return 1
      if [ -n "$no" ]; then buttons="{\"$no\", \"Not now\", \"$yes\"}"; else buttons="{\"Not now\", \"$yes\"}"; fi
      a=$(osascript -e 'on run argv' \
        -e "set r to display dialog (item 1 of argv) with title (item 2 of argv) buttons $buttons default button \"$yes\" with icon note" \
        -e 'return button returned of r' -e 'end run' "$msg" "$2" 2>/dev/null) || return 1
      case "$a" in "$yes") echo yes ;; "Not now") ;; *) echo no ;; esac; return 0 ;;
  esac
  return 1
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
bg_get() {  # log what -- "setup-kit.sh get what" in the background, in a session of
  # its own (setsid) so that stopping Lantern's window never stops the download
  if command -v setsid >/dev/null 2>&1; then setsid nohup "$DIR/setup-kit.sh" get "$2" > "$1" 2>&1 < /dev/null &
  else nohup "$DIR/setup-kit.sh" get "$2" > "$1" 2>&1 < /dev/null & fi
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
    ui "STEP more A stronger AI model"
    q "  This computer has $(( mem / 1024 )) GB of memory: it can run $T_NAME ($T_GB GB download),"
    q "  a stronger model than any in this kit. $T_NOTE"
    ans=$(ask "" "A stronger AI model"); QTEXT=""
    [ -n "$ans" ] || return 0
    if [ "$ans" = no ]; then
      : > "$MODELS/.skip-$T_ID"
      shown="$shown[$T_NAME: you answered N before (delete models/.skip-$T_ID to be asked again)]"
      echo "  Not asking again. To get it later: ./setup-kit.sh $T_ID"; continue
    fi
    if [ "${1:-}" = 1 ]; then   # setup: download it here, then look again (the library comes next)
      get_tier "$T_ID"
      if ! have "$T_PAT"; then echo "  $T_NAME did not download properly; run ./setup-kit.sh $T_ID to try again."; ui "WARN $T_NAME did not finish downloading. Run Install Lantern again to carry on where it stopped."; return 0; fi
      continue
    fi
    bg_get "$MODELS/download-$T_ID.log" "$T_ID"
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
  ui "STEP library An offline encyclopedia"
  q "  Lantern can also keep an offline encyclopedia for the AI to read: $L_NAME,"
  q "  about $T_GB GB. Fact questions are then answered from it, with quotes Lantern checks."
  ans=$(ask "" "Offline encyclopedia"); QTEXT=""
  [ -n "$ans" ] || return 0
  if [ "$ans" = no ]; then : > "$MODELS/.skip-library"; echo "  Not asking again. To get it later: ./setup-kit.sh library"; return 0; fi
  if [ "${1:-}" = 1 ]; then
    if ! get_library "$LP_ID"; then echo "  The encyclopedia did not finish. Run setup again to carry on (./setup-kit.sh library)."; ui "WARN The encyclopedia did not finish downloading. Run Install Lantern again to carry on where it stopped."; fi
    return 0
  fi
  bg_get "$MODELS/download-library.log" "$LP_ID"
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
  ui "STEP library The full Wikipedia"
  q "  Lantern can also keep the FULL English Wikipedia: every article, text without pictures,"
  q "  about $FP_GB GB (a long download -- hours). Explanation questions in Chat (\"explain\","
  q "  \"in detail\", \"how does\") are then read from whole articles; quick facts keep the small file."
  ans=$(ask optin "The full Wikipedia"); QTEXT=""
  [ -n "$ans" ] || return 0
  if [ "$ans" = no ]; then : > "$MODELS/.skip-library-full"; echo "  Not asking again. To get it later: ./setup-kit.sh library-full"; return 0; fi
  if [ "${1:-}" = 1 ]; then
    if ! get_full; then echo "  The full Wikipedia did not finish. Run ./setup-kit.sh library-full to carry on."; ui "WARN The full Wikipedia did not finish downloading. Run Install Lantern again to carry on where it stopped."; fi
    return 0
  fi
  bg_get "$MODELS/download-library-full.log" library-full
  echo "  Downloading in the background (progress: models/download-library-full.log; it resumes if stopped)."
  echo "  Start Lantern again when it is done."
}
check() {
  mem=$(mem_mb)
  echo "Memory: $(awk -v m="$mem" 'BEGIN { printf "%.1f", m / 1024 }') GB"
  echo "Drive: $(fs_type), $(free_gb) GB free"
  echo "Kit folder: $DIR"
  site=$(site_dir)
  if [ -n "$site" ]; then v=$(lantern_version "$site"); echo "Lantern: ${v:+$v, }$site"
  else echo "Lantern: not in the kit (./setup-kit.sh lantern downloads it)"; fi
  why=$(engine_fault "$ENGD") || why="it could not be checked"
  if [ "$why" = ok ]; then echo "Engine: llama.cpp starts on this computer$([ -f "$DIR/engine/$ENGD/BUILT-HERE.txt" ] && echo ' (built here)')$([ "$ENGD" = "$OS" ] || echo " (engine/$ENGD)")"
  elif [ "$why" = "it is not in the kit" ]; then echo "Engine: not in the kit (./setup-kit.sh engine)"
  elif [ "$OS" = linux ]; then echo "Engine: does not start here: $why (./setup-kit.sh build-engine builds one for this computer)"
  else echo "Engine: does not start here: $why"; fi
  for id in $TIERS; do
    tier "$id"
    if [ "$mem" -ge "$T_MEM" ]; then fits="runs here"; else fits="needs $(( T_MEM / 1024 )) GB memory"; fi
    if have "$T_PAT"; then h="in kit"
      case "$T_ID" in xl|big|laptop) if [ -s "$MODELS/$(vision_file)" ]; then h="$h, sees images"; else h="$h, no vision part (./setup-kit.sh vision)"; fi ;; esac
    else h="not in kit"; fi
    printf "  %-17s%-9s%-22s%s\n" "$T_NAME" "$T_GB GB" "$fits" "$h"
  done
  plan
  printf '%s' "$P_NOTES" | sed 's/^/  /; s/$/./'
  kos=$ENGD
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
LNX="llama-$BUILD-bin-ubuntu-x64.tar.gz"; WIN="llama-$BUILD-bin-win-cpu-x64.zip"
if [ -n "$GPU" ]; then LNX="llama-$BUILD-bin-ubuntu-vulkan-x64.tar.gz"; WIN="llama-$BUILD-bin-win-vulkan-x64.zip"; fi
case "$(uname -m)" in aarch64|arm64) LNX="llama-$BUILD-bin-ubuntu-arm64.tar.gz"; MACA="llama-$BUILD-bin-macos-arm64.tar.gz" ;;
  *) MACA="llama-$BUILD-bin-macos-x64.tar.gz" ;; esac
case "$(uname -s)" in
  Darwin) OS=mac; THIS="$MACA" ;;
  *) OS=linux; THIS="$LNX" ;;
esac
ENGD=$(engine_dir "$OS")
case "${1:-}" in
  offer) offer 0 || true; exit 0 ;;
  check) check; exit 0 ;;
  info)  # for the installer window: what this computer and the kit have, as key=value
    mem=$(mem_mb)
    echo "mem_mb=$mem"; echo "free_gb=$(free_gb)"; echo "fs=$(fs_type)"; echo "os=$OS"; echo "dir=$DIR"
    if [ "$mem" -ge 7000 ]; then tier laptop; echo "base=$T_NAME"; echo "base_gb=$T_GB"; echo "vision_gb=0.8"
    else tier 0.8b; echo "base=Qwen3.5 0.8B and 2B"; echo "base_gb=1.9"; echo "vision_gb=0"; fi
    if have "$T_PAT"; then echo "have_base=1"; fi
    for id in $TIERS; do tier "$id"; if have "$T_PAT"; then echo "best=$T_NAME"; break; fi; done
    why=$(engine_fault "$ENGD") || why="it could not be checked"; echo "engine=$why"
    if have_library; then echo "have_library=1"; fi
    site=$(site_dir); if [ -n "$site" ]; then echo "have_site=1"; echo "site=$site"; fi
    exit 0 ;;
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
echo "Lantern kit setup (llama.cpp $BUILD)"
if [ -z "$SETS" ]; then
  get_lantern || exit 1
  ui "STEP engine Getting the AI engine (llama.cpp $BUILD)"
  engine "$ENGD" "$THIS"
  engine_ready || exit 1
  ui "STEP model Getting the AI model"
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
    vision) for id in $TIERS; do tier "$id"; if have "$T_PAT"; then get_vision; fi; done ;;
    phone) phone ;;
    lantern) get_lantern new || exit 1 ;;
    usb) get_lantern || exit 1; engine linux "$LNX"; engine windows "$WIN"; engine mac "llama-$BUILD-bin-macos-arm64.tar.gz"; phone; get_tier laptop; get_tier big ;;
    engine) engine "$ENGD" "$THIS"; engine_ready || exit 1 ;;
    build-engine) if [ "$OS" != linux ]; then echo "build-engine is for Linux computers"; exit 1; fi; build_engine || exit 1 ;;
    *) if tier "$s"; then get_tier "$s"; else echo "unknown option: $s"; fi ;;
  esac
done
ui "DONE"
echo "Done. Start Lantern with ./start-lantern.sh (or start-lantern.bat on Windows)."
