#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_NAME="${RADARBOARD_DEV_APP_NAME:-Radarboard Dev.app}"
SOURCE_APP="${RADARBOARD_DEV_APP_SOURCE:-$DESKTOP_ROOT/src-tauri/target/release/bundle/macos/$APP_NAME}"
INSTALL_DIR="${RADARBOARD_DEV_APP_INSTALL_DIR:-/Applications}"
TARGET_APP="$INSTALL_DIR/$APP_NAME"
EXPECTED_IDENTIFIER="com.radarboard.client.dev"

if [ ! -d "$SOURCE_APP" ]; then
  echo "Dev app bundle not found at: $SOURCE_APP" >&2
  echo "Build it first with: pnpm desktop:build:dev-app" >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR"

if [ -L "$TARGET_APP" ]; then
  rm "$TARGET_APP"
elif [ -e "$TARGET_APP" ]; then
  identifier="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$TARGET_APP/Contents/Info.plist" 2>/dev/null || true)"
  if [ "$identifier" != "$EXPECTED_IDENTIFIER" ]; then
    echo "Refusing to replace unexpected app at: $TARGET_APP" >&2
    echo "Expected bundle identifier: $EXPECTED_IDENTIFIER" >&2
    echo "Found bundle identifier: ${identifier:-unknown}" >&2
    exit 1
  fi
  rm -rf "$TARGET_APP"
fi

ditto "$SOURCE_APP" "$TARGET_APP"

echo "Installed $TARGET_APP from $SOURCE_APP"
