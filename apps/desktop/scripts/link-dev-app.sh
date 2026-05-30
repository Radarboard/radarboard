#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_NAME="${RADARBOARD_DEV_APP_NAME:-Radarboard Dev.app}"
SOURCE_APP="${RADARBOARD_DEV_APP_SOURCE:-$DESKTOP_ROOT/src-tauri/target/release/bundle/macos/$APP_NAME}"
INSTALL_DIR="${RADARBOARD_DEV_APP_INSTALL_DIR:-/Applications}"
TARGET_APP="$INSTALL_DIR/$APP_NAME"

if [ ! -d "$SOURCE_APP" ]; then
  echo "Dev app bundle not found at: $SOURCE_APP" >&2
  echo "Build it first with: pnpm desktop:build:dev-app" >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR"
ln -sfn "$SOURCE_APP" "$TARGET_APP"

echo "Linked $TARGET_APP -> $SOURCE_APP"
