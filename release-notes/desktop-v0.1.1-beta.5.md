# Radarboard Desktop desktop-v0.1.1-beta.5

This beta focuses on the macOS startup crash found in beta4.

## Highlights

- Fixes a packaged desktop startup crash caused by the bundled helper process aborting before the local Radarboard server became ready.
- Launches the bundled helper with the macOS-compatible Node runtime flag needed on current macOS releases.
- Keeps Radarboard open with a diagnostic startup screen if the local server fails, instead of letting the app abort during launch.
- Adds a release validation smoke test that starts the packaged helper and requires it to print a local server URL before a macOS release artifact is accepted.

## Install notes

- Install the DMG from this beta release and replace the existing Radarboard app in `/Applications`.
- If beta4 is installed, quit Radarboard fully before replacing it.
