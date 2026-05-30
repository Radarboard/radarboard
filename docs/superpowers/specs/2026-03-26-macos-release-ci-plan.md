# Harden macOS Release CI For The Tauri Desktop App

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md). It records the macOS release-signing and notarization rollout that follows the initial unsigned macOS CI setup.

## Purpose / Big Picture

Radarboard already has a macOS desktop build path, but it was not ready to produce signed, notarized release artifacts from GitHub Actions. After this change, the repository includes a dedicated macOS release workflow that imports a Developer ID certificate into a temporary keychain, validates notarization credentials, builds a signed Apple Silicon macOS release, notarizes it through Tauri’s standard macOS flow, and creates a draft GitHub release with the packaged artifacts.

## Scope

In scope:
- Add a macOS release workflow for signed and notarized Tauri releases.
- Validate required GitHub secrets early in the workflow.
- Document the required secrets and release trigger in the desktop README.
- Align macOS minimum system version with the Apple Silicon-only build target.

Out of scope:
- iOS/iPad CI.
- Windows or Linux release automation.
- Turning on the in-app updater.

## Progress

- [x] 2026-03-26 17:05Z: Reviewed the existing unsigned macOS CI flow and Tauri desktop config.
- [x] 2026-03-26 17:18Z: Added a dedicated signed/notarized macOS release workflow and README guidance.
- [x] 2026-03-26 17:22Z: Updated the Tauri macOS minimum system version for Apple Silicon-only releases.

## Surprises & Discoveries

- Observation: Tauri still writes the final macOS `.app` and `.dmg` bundles under `src-tauri/target/release/bundle/` even when the build command is invoked with `--target aarch64-apple-darwin`.
  Evidence: Local `tauri build --target aarch64-apple-darwin` runs continued to generate bundle outputs in the default release bundle directory.

## Decision Log

- Decision: Use a separate release workflow instead of overloading the unsigned CI workflow.
  Rationale: The unsigned PR build and the signed/notarized release flow have different permissions, secrets, triggers, and failure modes.
  Date/Author: 2026-03-26 / Codex

- Decision: Support either App Store Connect API key notarization or Apple ID notarization credentials in CI.
  Rationale: Both are supported by Tauri, and allowing either mode reduces migration friction while still failing early if neither mode is configured.
  Date/Author: 2026-03-26 / Codex

## Outcomes & Retrospective

The repository now has a dedicated macOS release workflow that is ready for signed/notarized releases once the required GitHub secrets are configured. The remaining work is operational rather than code changes: populate the secrets, push a `desktop-v*` tag or run the workflow manually, and confirm the notarized draft release artifacts in GitHub.

Revision note: 2026-03-26. Initial plan written at implementation time to capture the release-hardening rollout.
