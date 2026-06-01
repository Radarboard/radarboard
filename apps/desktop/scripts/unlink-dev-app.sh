#!/bin/bash

set -euo pipefail

APP_NAME="${RADARBOARD_DEV_APP_NAME:-Radarboard Dev.app}"
INSTALL_DIR="${RADARBOARD_DEV_APP_INSTALL_DIR:-/Applications}"
TARGET_APP="$INSTALL_DIR/$APP_NAME"
EXPECTED_IDENTIFIER="com.radarboard.client.dev"

if [ -L "$TARGET_APP" ]; then
  rm "$TARGET_APP"
  echo "Removed symlink $TARGET_APP"
  exit 0
fi

if [ -e "$TARGET_APP" ]; then
  identifier="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$TARGET_APP/Contents/Info.plist" 2>/dev/null || true)"
  if [ "$identifier" != "$EXPECTED_IDENTIFIER" ]; then
    echo "Refusing to remove unexpected app at: $TARGET_APP" >&2
    echo "Expected bundle identifier: $EXPECTED_IDENTIFIER" >&2
    echo "Found bundle identifier: ${identifier:-unknown}" >&2
    exit 1
  fi
  rm -rf "$TARGET_APP"
  echo "Removed $TARGET_APP"
  exit 0
fi

echo "No dev app found at $TARGET_APP"
