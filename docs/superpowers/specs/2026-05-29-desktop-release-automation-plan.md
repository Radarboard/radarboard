# Automate Desktop Release Tagging

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture

Radarboard desktop releases should move from a committed version candidate to a GitHub release without a developer manually creating tags or uploading artifacts. After this work, merging a valid desktop version bump to `main` creates the matching `desktop-v*` tag. That tag triggers the existing macOS signing/notarization workflow, which creates a draft GitHub release. Publishing that release triggers the existing Homebrew tap sync.

## Scope

In scope: GitHub Actions triggers and tag validation, a manual tag escape hatch for the current committed desktop candidate, release-info script test coverage, and release documentation.

Out of scope: publishing a real GitHub release, pushing tags from the local machine, changing Apple signing secrets, changing the Homebrew tap repository, or removing the human publish gate for draft releases.

## Progress

- [x] 2026-05-29 21:00Z: Audited existing `changesets`, desktop release, and Homebrew tap workflows.
- [x] 2026-05-29 21:05Z: Identified that `.github/workflows/changesets.yml` lacked a `push` trigger even though release/tag jobs require `push` on `main`.
- [x] 2026-05-29 21:12Z: Wired `main` pushes and manual dispatch into desktop tag creation.
- [x] 2026-05-29 21:14Z: Added script tests for forced current-candidate tag info.
- [x] 2026-05-29 21:18Z: Validated changed workflow and release scripts locally.

## Surprises & Discoveries

- Observation: `.github/workflows/changesets.yml` had only `workflow_dispatch`, while both `release` and `desktop-tag` jobs were guarded by `github.event_name == 'push' && github.ref == 'refs/heads/main'`.
  Evidence: The workflow could not auto-create desktop tags after merging a release candidate to `main`.

## Decision Log

- Decision: Keep GitHub releases as drafts from the tag workflow.
  Rationale: Desktop artifacts need a real install/notarization check before public publishing, and Homebrew should only sync after the release is published.
  Date/Author: 2026-05-29 / Codex

- Decision: Add a manual workflow dispatch input for tag creation instead of requiring local `git tag`.
  Rationale: It lets maintainers test the release chain from GitHub Actions while preserving one source of truth for tag creation.
  Date/Author: 2026-05-29 / Codex

## Outcomes & Retrospective

Implemented the CI-driven tag path. A push to `main` now runs `.github/workflows/changesets.yml`;
when the desktop version changed, the `desktop-tag` job runs `pnpm release:desktop:dry-run`, checks
for existing local and remote tags, then pushes the matching `desktop-v<version>` tag. Manual
dispatch can also tag the current committed candidate with `create_desktop_tag=true`.

## Context and Orientation

The desktop candidate is represented by aligned versions in `apps/desktop/package.json`, `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/src-tauri/Cargo.toml`, and `apps/desktop/src-tauri/Cargo.lock`. The release notes must exist at `release-notes/desktop-v<version>.md`.

`.github/workflows/changesets.yml` owns release PR maintenance and desktop tag creation. `.github/workflows/desktop-macos-release.yml` listens for `desktop-v*` tags, builds the macOS app, signs and notarizes it, and creates a draft GitHub release. `.github/workflows/desktop-homebrew-tap-sync.yml` listens for published GitHub releases and updates the stable or beta Homebrew cask.

## Plan of Work

Update `.github/workflows/changesets.yml` so it runs on pushes to `main` and can also be manually dispatched with a `create_desktop_tag` input. The desktop tag job will read the current candidate, run the local desktop release dry-run, check local and remote tags, then create and push the tag only when the candidate is valid.

Update `scripts/desktop-release-info.ts` so CI can report the current desktop tag either by comparing a base revision on push or by forcing the current candidate during manual dispatch. Add tests for both paths.

Update `apps/desktop/RELEASING.md` so the documented flow matches the automated chain.

## Concrete Steps

From `/Users/thedaviddias/Projects/radarboard`:

1. Edit `.github/workflows/changesets.yml`.
2. Edit `scripts/desktop-release-info.ts` and add `scripts/desktop-release-info.test.ts`.
3. Edit `apps/desktop/RELEASING.md`.
4. Run `pnpm exec vitest run scripts/desktop-release-info.test.ts scripts/prepare-desktop-release.test.ts scripts/update-homebrew-cask.test.ts`.
5. Run `pnpm exec tsc-files --noEmit scripts/desktop-release-info.ts scripts/desktop-release-info.test.ts scripts/prepare-desktop-release.ts scripts/prepare-desktop-release.test.ts`.
6. Run `pnpm exec biome check .github/workflows/changesets.yml scripts/desktop-release-info.ts scripts/desktop-release-info.test.ts apps/desktop/RELEASING.md docs/superpowers/specs/2026-05-29-desktop-release-automation-plan.md`.

## Validation and Acceptance

Acceptance means a push to `main` with a valid desktop version change creates exactly one `desktop-v<version>` tag, and a manual dispatch with `create_desktop_tag=true` can create the tag for the current committed candidate. Invalid candidates must fail before tag creation if versions are misaligned, notes are missing or placeholder-only, or the tag already exists locally or remotely.

## Idempotence and Recovery

The validation and dry-run commands are safe to repeat. If tag creation fails because the tag already exists, the workflow should stop before creating a duplicate. If the GitHub release workflow fails after a tag exists, rerun the tag-triggered release workflow or delete the draft release artifact manually; do not create a second tag for the same version.

## Artifacts and Notes

- `pnpm exec vitest run scripts/desktop-release-info.test.ts scripts/prepare-desktop-release.test.ts scripts/update-homebrew-cask.test.ts`: 3 files passed, 13 tests passed.
- `pnpm exec tsc-files --noEmit scripts/desktop-release-info.ts scripts/desktop-release-info.test.ts scripts/prepare-desktop-release.ts scripts/prepare-desktop-release.test.ts`: passed with no output.
- `pnpm release:desktop:dry-run`: validated `desktop-v0.1.1-beta.1`.
- `pnpm exec tsx scripts/desktop-release-info.ts --force-current`: emitted `changed=true` for `desktop-v0.1.1-beta.1`.
- `ruby -e 'require "yaml"; YAML.load_file(ARGV.fetch(0)); puts "yaml ok"' .github/workflows/changesets.yml`: `yaml ok`.
- `pnpm exec biome check --write ...`: Biome ignored these targeted paths and processed 0 files, so it did not provide useful validation for this set.

## Interfaces and Dependencies

This work depends on pnpm, tsx, Vitest, GitHub Actions, `changesets/action`, `tauri-apps/tauri-action`, Apple signing secrets, and the existing Homebrew tap sync secret/variable pair.
