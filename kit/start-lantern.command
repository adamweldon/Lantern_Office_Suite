#!/bin/sh
# Double-click on a Mac. If macOS blocks it: right-click > Open > Open.
cd "$(dirname "$0")" && exec ./start-lantern.sh "$@"
