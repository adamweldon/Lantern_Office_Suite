#!/bin/sh
# Install Lantern (Mac) -- double-click: sets up Lantern's AI on this Mac (needs
# internet once). Questions come up as dialogs; this window shows the downloads.
# The first time, macOS may say it cannot open it: open System Settings >
# Privacy & Security, scroll down and choose Open Anyway (older macOS:
# right-click this file > Open > Open).
cd "$(dirname "$0")/kit" || exit 1
chmod +x ./*.sh ./*.command 2>/dev/null
# Once this one is allowed, the rest of the folder need not be asked about again.
xattr -dr com.apple.quarantine .. 2>/dev/null
say() {  # say "message" buttons default icon -> the button pressed ("" when no dialog)
  osascript -e 'on run argv' \
    -e "set r to display dialog (item 1 of argv) with title \"Lantern\" buttons $2 default button \"$3\" with icon $4" \
    -e 'return button returned of r' -e 'end run' "$1" 2>/dev/null
}
LANTERN_POPUP=osascript sh ./setup-kit.sh
if [ $? -eq 0 ]; then
  a=$(say "Lantern is ready. Its AI works without internet from now on.

To start it later, double-click \"Start Lantern (Mac)\" in the Lantern folder." '{"Close", "Start Lantern now"}' "Start Lantern now" note)
  if [ "$a" = "Start Lantern now" ]; then LANTERN_POPUP=osascript exec sh ./start-lantern.sh; fi
else
  say "Setup stopped before it finished. This window shows what happened (often: no internet, or the drive is full).

Fix that, then double-click Install Lantern (Mac) again. Downloads carry on where they stopped." '{"OK"}' OK caution >/dev/null
fi
