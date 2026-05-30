#!/bin/bash

set -euo pipefail

APP_NAME="${RADARBOARD_DEV_APP_NAME:-Radarboard Dev.app}"
INSTALL_DIR="${RADARBOARD_DEV_APP_INSTALL_DIR:-/Applications}"
TARGET_APP="$INSTALL_DIR/$APP_NAME"

if [ -L "$TARGET_APP" ]; then
  rm "$TARGET_APP"
  echo "Removed symlink $TARGET_APP"
  exit 0
fi

if [ -e "$TARGET_APP" ]; then
  echo "Refusing to remove non-symlink path: $TARGET_APP" >&2
  exit 1
fi

echo "No dev app symlink found at $TARGET_APP"
