# Enable The macOS Auto-Update Flow For Radarboard Desktop

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md). It records the updater rollout for the Tauri desktop app.

## Purpose / Big Picture

Radarboard already has a macOS desktop build and release path, but users cannot yet discover, download, and install new versions from inside the app. After this change, signed macOS releases produce updater metadata, the desktop runtime is configured for Tauri updater checks, and the frontend automatically checks for updates on startup while also supporting manual checks and install/relaunch from inside the app.

## Scope

In scope:
- Generate and configure the updater signing public key.
- Enable Tauri updater config and capabilities.
- Update the macOS release workflow to ship updater metadata.
- Add desktop frontend update checks, install flow, and relaunch flow.
- Document the updater release requirements.

Out of scope:
- iOS or iPad update flows.
- Mac App Store submission.
- Windows and Linux updater support.

## Progress

- [x] 2026-03-26 21:20Z: Audited the current desktop runtime, existing release workflows, and existing update-related hooks and commands.
- [x] 2026-03-26 21:45Z: Enabled updater config, release metadata, runtime plugin registration, and desktop frontend update UX.
- [x] 2026-03-26 21:28Z: Generated the updater keypair locally under `apps/desktop/.tauri/` and committed the public key into Tauri config while keeping the private key ignored.
- [x] 2026-03-26 21:30Z: Verified targeted updater/tray hook tests pass and `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` succeeds.

## Decision Log

- Decision: Use the Tauri updater flow against published GitHub release metadata for direct-download macOS releases.
  Rationale: It matches the current GitHub-based release process and avoids adding a separate update server immediately.
  Date/Author: 2026-03-26 / Codex

- Decision: Keep update discovery tied to published releases, not drafts.
  Rationale: The app should only offer versions that are ready for end users to install.
  Date/Author: 2026-03-26 / Codex

## Outcomes & Retrospective

The repository now contains the core updater path for macOS direct-download releases. Tauri is configured to generate updater artifacts, the desktop runtime registers the updater plugin, the desktop frontend checks for updates on startup and responds to manual tray-triggered checks, and the macOS release workflow now expects the updater signing key so `latest.json` and related metadata can be trusted by installed apps.

The remaining operational requirement is to add `TAURI_SIGNING_PRIVATE_KEY` and the Apple release secrets in GitHub before the first published updater-backed release. Draft releases remain invisible to the updater until they are published.
