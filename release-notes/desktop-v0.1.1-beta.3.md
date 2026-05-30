# Radarboard Desktop desktop-v0.1.1-beta.3

Emergency desktop beta for replacing the hidden `desktop-v0.1.1-beta.2` artifact.

## Highlights

- Keeps the refreshed Radarboard icon set from `desktop-v0.1.1-beta.2`.
- Renames the bundled local sidecar executable from `radarboard-server` to `radarboard-helper` so macOS surfaces a less confusing helper-process name.
- Adds release validation for the final macOS app and DMG: bundle shape, executable signatures, native module signatures, deep app signature, and Gatekeeper assessment.
- Requires signed and notarized artifacts for beta and stable desktop releases. Unsigned builds are limited to alpha releases.

## Install notes

- Download the `Radarboard-0.1.1-beta.3-macos-aarch64.dmg` asset from this GitHub prerelease after the release validation workflow passes.
- This beta is built for Apple Silicon Macs.
- Remove `0.1.1-beta.2` if you installed it; that artifact was hidden because its shipped app bundle failed code-signature validation.
