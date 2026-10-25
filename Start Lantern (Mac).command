#!/bin/sh
# Start Lantern (Mac) -- double-click: starts Lantern's AI and opens Lantern.
# Keep this window open while you use Lantern; closing it stops the AI.
cd "$(dirname "$0")/kit" || exit 1
LANTERN_POPUP="${LANTERN_POPUP:-osascript}" exec sh ./start-lantern.sh "$@"
