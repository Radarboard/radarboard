# Radarboard Desktop desktop-v0.1.1-beta.7

## Highlights

- Repackages the desktop runtime so macOS Gatekeeper validates the downloaded app reliably instead of flagging the DMG as damaged.
- Keeps the helper as a plain sidecar binary inside Radarboard, avoiding the separate helper app surface.
- Uses the current Radarboard tray icon assets and keeps update checks user-initiated.

## Install notes

- Replace any previously installed beta with this DMG.
- If macOS still shows a damaged-app warning, remove `/Applications/Radarboard.app`, mount this DMG again, and copy Radarboard into Applications once more.
