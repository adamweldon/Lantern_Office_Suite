#!/bin/sh
# lantern-kit.sh -- what "Install Lantern (Linux)" and "Start Lantern (Linux)"
# run when double-clicked (also: sh kit/lantern-kit.sh install | start).
# Opens Lantern's own window (lantern-kit.py: Python 3 with Tk, which Raspberry
# Pi OS has). Without Tk it opens a terminal window with the same steps, and
# asks the questions in popups when zenity or kdialog is there. With no
# desktop at all (over SSH) it runs right here in this terminal.
DIR="$(cd "$(dirname "$0")" && pwd)"
MODE="${1:-install}"
case "$MODE" in install|start) ;; *) echo "usage: sh $0 install|start"; exit 2 ;; esac
# A zip, a download or a FAT drive can drop the "may run" mark from the scripts.
chmod +x "$DIR"/*.sh "$DIR"/*.command "$DIR"/lantern-kit.py 2>/dev/null
if [ "$MODE" = install ]; then RUN="setup-kit.sh"; else RUN="start-lantern.sh"; fi

# 1. Lantern's window
ERRLOG="${TMPDIR:-/tmp}/lantern-kit-$(id -u).log"
NOTE=""
if [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
  for py in python3 python; do
    if command -v "$py" >/dev/null 2>&1 && "$py" -c 'import sys, tkinter; sys.exit(sys.version_info < (3, 6))' 2>/dev/null; then
      "$py" "$DIR/lantern-kit.py" "$MODE" 2>"$ERRLOG"
      rc=$?
      [ $rc -eq 0 ] && exit 0
      # 3: no window could open. Anything else: the window stopped with an error --
      # carry on in a terminal rather than leave nothing on the screen.
      [ $rc -eq 3 ] || NOTE="Lantern's window stopped with an error (details: $ERRLOG), so this carries on here."
      break
    fi
  done
fi

# 2. No desktop: right here
if [ -z "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] || [ -t 1 ]; then
  [ -z "$NOTE" ] || { echo "$NOTE"; tail -n 5 "$ERRLOG" 2>/dev/null; echo; }
  cd "$DIR" && exec sh "./$RUN"
fi

# 3. A terminal window, questions as popups when a dialog program is there
POPUP=""
for p in zenity kdialog; do if command -v $p >/dev/null 2>&1; then POPUP=$p; break; fi; done
T=$(mktemp "${TMPDIR:-/tmp}/lantern-XXXXXX") || exit 1
cat > "$T" <<EOF
#!/bin/sh
cd "$DIR" || exit 1
echo "Lantern -- $( [ "$MODE" = install ] && echo "installing its AI (needs internet once)" || echo "starting its AI" )"
[ -z "$NOTE" ] || echo "$NOTE"
echo ""
LANTERN_POPUP="$POPUP" sh "./$RUN"
r=\$?
echo ""
if [ \$r -eq 0 ]; then printf "Finished. Press Enter to close this window. "
else printf "Stopped -- the lines above say why. Fix that, then run it again (downloads carry on). Press Enter to close. "; fi
read x
rm -f "$T"
EOF
chmod +x "$T"
for term in x-terminal-emulator lxterminal gnome-terminal kgx ptyxis konsole xfce4-terminal mate-terminal tilix terminator alacritty kitty xterm; do
  command -v $term >/dev/null 2>&1 || continue
  case $term in
    gnome-terminal|kgx|ptyxis) $term -- sh "$T" && exit 0 ;;
    xfce4-terminal|mate-terminal|terminator) $term -x sh "$T" && exit 0 ;;
    *) $term -e sh "$T" && exit 0 ;;
  esac
done
rm -f "$T"
MSG="Lantern needs a terminal window or Python's Tk (python3-tk) to show its steps.
Open a terminal and type:  sh \"$DIR/$RUN\""
if command -v zenity >/dev/null 2>&1; then zenity --error --no-markup --title="Lantern" --text="$MSG"
elif command -v kdialog >/dev/null 2>&1; then kdialog --title Lantern --error "$MSG"
elif command -v xmessage >/dev/null 2>&1; then xmessage "$MSG"
else echo "$MSG" >&2; fi
exit 1
