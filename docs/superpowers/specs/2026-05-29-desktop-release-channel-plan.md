# Desktop Release Channel Flow

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture

Radarboard needs a complete desktop distribution flow before the first public channel: internal alpha artifacts, signed beta releases for testers, stable releases for public install/update, and Homebrew tap updates that match the release channel. After this change, the repo should encode the release channel in the desktop version/tag, mark alpha and beta releases as GitHub prereleases, keep stable updater/Homebrew behavior clean, and publish a separate beta cask when a beta release is published.

## Scope

In scope:
- Add a release preparation command for `alpha`, `beta`, and `stable` desktop versions.
- Make the macOS release workflow infer prerelease status from `desktop-v*-alpha.*` and `desktop-v*-beta.*` tags.
- Keep alpha out of Homebrew and sync beta prereleases to `radarboard-beta`.
- Keep stable releases syncing to `radarboard`.
- Document the operator playbook.

Out of scope:
- A Mac App Store release lane.
- Separate beta updater endpoints inside the installed app.
- Windows/Linux release channels.

## Progress

- [x] 2026-05-29 16:05 ET: Audited the existing desktop release, updater, and Homebrew workflows.
- [x] 2026-05-29 16:20 ET: Added release channel preparation, beta cask generation, workflow channel detection, and release-note guardrails.
- [x] 2026-05-29 16:30 ET: Updated the desktop release playbook with alpha, beta, stable, and Homebrew steps.

## Decision Log

- Decision: Encode the channel in the desktop SemVer prerelease and GitHub tag.
  Rationale: `desktop-v0.2.0-beta.1` is explicit, works with Cargo/package/Tauri versions, and lets GitHub Actions infer prerelease behavior without a second source of truth.
  Date/Author: 2026-05-29 / Codex

- Decision: Keep alpha as unsigned/internal CI artifacts and beta as signed/notarized GitHub prereleases.
  Rationale: Alpha should optimize for iteration, while beta should validate the real public install path without updating the stable Homebrew cask.
  Date/Author: 2026-05-29 / Codex

- Decision: Publish beta Homebrew updates to `radarboard-beta`, not `radarboard`.
  Rationale: Testers can install beta through Homebrew without breaking the stable cask path.
  Date/Author: 2026-05-29 / Codex

## Outcomes & Retrospective

The repo now has a channel-aware desktop release flow. Remaining operational work is to configure the GitHub secrets and repository variable described in `apps/desktop/RELEASING.md`, create the Homebrew tap repository, and run a first dry beta release before publishing a stable release.
