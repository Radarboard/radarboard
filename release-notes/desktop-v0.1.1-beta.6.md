# Radarboard Desktop desktop-v0.1.1-beta.6

This beta replaces beta5 with the launch-level helper fix verified from a locally mounted DMG.

## Highlights

- Fixes the macOS packaged helper startup crash by launching the bundled Node runtime with the compatibility flag required on current macOS releases.
- Keeps Radarboard open with a diagnostic screen if the local server cannot start, instead of aborting during launch.
- Keeps draining helper stdout after the startup URL is read, preventing later dashboard requests from hitting `EPIPE` and destabilizing the local server.
- Adds a macOS release smoke test that launches the packaged helper and requires it to print a local server URL.

## Install notes

- Install the DMG from this beta release and replace the existing Radarboard app in `/Applications`.
- If beta4 or beta5 is installed, quit Radarboard fully before replacing it.
