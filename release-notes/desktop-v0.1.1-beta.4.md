# Radarboard Desktop desktop-v0.1.1-beta.4

Emergency desktop beta for replacing the hidden `desktop-v0.1.1-beta.2` release and the blocked `desktop-v0.1.1-beta.3` draft.

## Highlights

- Keeps the refreshed Radarboard icon set from the previous beta.
- Renames the bundled local sidecar executable from `radarboard-server` to `radarboard-helper` so macOS surfaces a less confusing helper-process name.
- Imports Apple's Developer ID intermediate certificates during CI signing so shipped artifacts embed a complete certificate authority chain.
- Adds release validation for the final macOS app, local DMG, and downloaded GitHub draft DMG before publishing.
- Requires signed and notarized artifacts for beta and stable desktop releases. Unsigned builds are limited to alpha releases.

## Install notes

- Download the `Radarboard-0.1.1-beta.4-macos-aarch64.dmg` asset from this GitHub prerelease after release validation passes.
- This beta is built for Apple Silicon Macs.
- Remove `0.1.1-beta.2` if you installed it; that artifact was hidden because its shipped app bundle failed code-signature validation.
