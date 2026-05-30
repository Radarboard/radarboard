# Roll Out Changesets Enforcement For Internal Radarboard Workspaces

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md). It is written so a new contributor can resume the work using only this file and the current repository state.

## Purpose / Big Picture

Radarboard currently has many internal workspaces under `packages/`, `widgets/`, `plugins/`, `integrations/`, and `features/`, but there is no enforced release-note or versioning discipline for changes to those libraries. After this change, qualifying library edits must include a Changesets entry, local git hooks must block missing changesets before commit or push, pull requests must fail CI when the requirement is violated, and `main` must maintain an automated release PR that versions internal workspaces and updates changelogs. The change is observable when a source edit to an enforced workspace fails without `pnpm changeset`, docs/tests-only edits remain allowed without a changeset, and merges to `main` produce a `Version Packages` pull request rather than publishing to npm.

## Scope

In scope:
- Add Changesets CLI and root scripts.
- Add `.changeset` configuration and contributor documentation.
- Add explicit `version` fields to enforced internal workspaces that do not already define one.
- Add a repository validator that detects qualifying workspace changes and blocks missing changesets.
- Integrate the validator into `lefthook` for `pre-commit` and `pre-push`.
- Add GitHub Actions validation and release-PR automation for Changesets.
- Document the required GitHub branch-protection check for `main`.

Out of scope:
- Publishing any package to npm.
- Changing `workspace:*` dependency protocol usage.
- Versioning `apps/*` workspaces as part of this rollout.
- Any release policy for template packages under `_template`.

## Progress

- [x] 2026-03-26 14:40Z: Audited the monorepo layout, existing hooks, current workflows, and workspace package metadata.
- [x] 2026-03-26 14:50Z: Wrote the initial ExecPlan for the Changesets rollout.
- [x] 2026-03-26 15:10Z: Added Changesets CLI, root scripts, `.changeset/config.json`, contributor docs, and a rollout changeset entry.
- [x] 2026-03-26 15:18Z: Added `version` fields to all enforced non-template workspaces and kept templates excluded.
- [x] 2026-03-26 15:24Z: Implemented `scripts/check-changesets.ts` and wired it into `lefthook` for `pre-commit` and `pre-push`.
- [x] 2026-03-26 15:29Z: Added `.github/workflows/changesets.yml` for PR validation and release PR automation on `main`.
- [x] 2026-03-26 15:42Z: Verified staged-mode, branch-diff, docs-only, and release-PR validator behavior in isolated temporary git repositories.

## Surprises & Discoveries

- Observation: There is no existing Changesets setup in the repository.
  Evidence: A repository-wide search for `changeset`, `changesets`, and `@changesets` returned no existing config or scripts outside third-party references.

- Observation: Widgets already define explicit versions, but `packages/`, `plugins/`, `integrations/`, and `features/` do not.
  Evidence: Workspace package audit showed `widgets/*` have `version` fields while the enforced non-widget library groups do not.

- Observation: GitHub workflow coverage is currently narrow and does not provide a generic required status for release hygiene.
  Evidence: The only existing workflow is `.github/workflows/webhook-relay-ci.yml`.

- Observation: The local `main` branch is already ahead of `origin/main` by three unrelated commits, so commit-based validation against `origin/main` will continue to surface pre-existing branch differences until those commits are pushed or rebased.
  Evidence: `git status -sb` reported `## main...origin/main [ahead 3]` during verification.

## Decision Log

- Decision: Use Changesets for internal versioning only in v1.
  Rationale: The repository needs release discipline and changelogs now, but not npm publishing or registry credentials.
  Date/Author: 2026-03-26 / Codex

- Decision: Enforce changesets for `packages/`, `widgets/`, `plugins/`, `integrations/`, and `features/`, but not for `apps/*`.
  Rationale: The internal libraries form the shared API surface used across apps, while app workspaces remain deployment targets rather than reusable packages.
  Date/Author: 2026-03-26 / Codex

- Decision: Allow docs/tests/stories-only edits to bypass the changeset requirement.
  Rationale: Requiring a release note for purely non-runtime changes would create noise and encourage low-signal changesets.
  Date/Author: 2026-03-26 / Codex

- Decision: Exclude `_template` workspaces from versioning and enforcement.
  Rationale: Template packages are scaffolding inputs, not real deliverables, and should not produce release churn.
  Date/Author: 2026-03-26 / Codex

## Outcomes & Retrospective

The rollout now exists in the repository as a complete internal Changesets setup. Root scripts were added for authoring, checking, and versioning changesets. `.changeset/config.json` enables private workspace versioning on `main`, ignores all app workspaces and template manifests, and keeps the rollout internal-only. A contributor guide and a concrete rollout changeset were added under `.changeset/`.

All enforced non-template workspaces under `packages/`, `plugins/`, `integrations/`, and `features/` now have explicit `version` fields so Changesets can version them consistently. `lefthook.yml` now blocks missing changesets in both staged-file and branch-diff modes, and `.github/workflows/changesets.yml` adds the `Changesets / validate` PR status plus automated release PR maintenance on `main`.

Verification was completed in isolated temporary git repositories to avoid touching unrelated code. The validator correctly failed qualifying source changes without a changeset, passed docs-only edits, passed staged and committed source changes with a changeset, and passed the simulated release-PR case where a consumed changeset is deleted while package versions and changelogs are updated.

Remaining external follow-up: GitHub branch protection for `main` must mark `Changesets / validate` as required. That cannot be enforced through repository files alone.

## Context and Orientation

The repository root contains the monorepo orchestrator files:

- `package.json`
  Root scripts, development dependencies, and `lefthook` installation via `prepare`.

- `pnpm-workspace.yaml`
  Defines the workspace families: `apps/*`, `packages/*`, `features/*`, `widgets/*`, `integrations/*`, and `plugins/*`.

- `turbo.json`
  Defines shared task orchestration for build, test, and typecheck commands.

- `lefthook.yml`
  Already enforces repo checks at `pre-commit`, `commit-msg`, and `pre-push`. Changesets enforcement must be added here without weakening the existing checks.

Relevant rollout targets:

- `.changeset/config.json`
  The Changesets configuration file. It must point to `main` as the base branch, support private package versioning, and ignore `apps/*` and `_template` workspaces.

- `.changeset/README.md`
  The contributor-facing explanation for when and how to create a changeset.

- `scripts/check-changesets.ts`
  The new validation script that determines whether a changeset is required for the current diff.

- `.github/workflows/changesets.yml`
  The new GitHub Actions workflow that validates pull requests and maintains the release PR on `main`.

Key terms:

- `qualifying change`
  A file change under an enforced workspace that can affect shipped behavior, package metadata, build behavior, or public API. Source edits, package manifest changes, and build/config edits qualify. Docs/tests/stories-only changes do not.

- `release PR`
  The pull request generated by `changesets/action` that bumps versions, updates changelogs, and consumes pending changesets. In this rollout it does not publish to npm.

- `private workspace versioning`
  Changesets support for bumping versions and changelogs even when package manifests remain `"private": true`.

## Plan of Work

Start by updating the root toolchain so Changesets is a first-class part of the repository. This includes the root scripts and `.changeset` configuration, because every later enforcement step depends on standard command names and package-selection rules.

Next, normalize workspace metadata by adding missing `version` fields to every enforced non-app, non-template workspace that lacks one. Widgets already have versions and should remain unchanged. This step is required before the release PR flow can version private packages consistently.

Then build the validator in `scripts/check-changesets.ts`. It must support two operating modes: staged-file checking for `pre-commit` and branch-diff checking for `pre-push` or CI. The logic should ignore apps and templates entirely, treat docs/tests/stories patterns as exempt, and fail hard with a precise remediation command whenever qualifying workspace changes are present without a matching `.changeset/*.md` file in the relevant diff.

With the validator in place, wire it into `lefthook.yml` and then add the GitHub workflow. The PR job should run the same validator logic so local and remote enforcement stay aligned. The `main` push job should use `changesets/action@v1` in release-PR mode only, with explicit permissions and concurrency.

Finish by running targeted validation commands, recording outcomes here, and documenting the remaining manual GitHub branch-protection step that cannot be enforced through repository files alone.

## Concrete Steps

Run commands from the repository root unless another directory is specified.

Install and lock dependencies:

    cd /Users/thedaviddias/Projects/radarboard
    pnpm install

Run the new validator against the current branch diff:

    cd /Users/thedaviddias/Projects/radarboard
    pnpm changeset:check

Run the validator in staged-file mode:

    cd /Users/thedaviddias/Projects/radarboard
    pnpm exec tsx scripts/check-changesets.ts --since=HEAD --staged

Validate the new workflow-supporting scripts and package metadata:

    cd /Users/thedaviddias/Projects/radarboard
    pnpm biome check package.json lefthook.yml .github/workflows/changesets.yml .changeset scripts/check-changesets.ts

Run repository-level type and test checks that cover the new script path:

    cd /Users/thedaviddias/Projects/radarboard
    pnpm typecheck
    pnpm test --affected

## Validation and Acceptance

Acceptance is behavioral:

- Editing a qualifying file under an enforced workspace and attempting to commit without a changeset must fail in `pre-commit`.
- Editing only a README, MDX file, test, or story under an enforced workspace must not require a changeset.
- Pushing a branch with qualifying enforced-workspace changes but no changeset must fail in `pre-push`.
- Opening a pull request with the same missing changeset must fail the GitHub `validate` job.
- Merging qualifying changes to `main` must create or update a `Version Packages` PR instead of publishing packages.
- Apps and `_template` workspaces must remain outside enforcement and version bump behavior.

## Idempotence and Recovery

Most steps are safe to repeat:

- Re-running `pnpm install` and validator commands is safe.
- Re-running `changesets/action` on `main` is safe because it updates the existing release PR rather than publishing in this setup.
- If a package `version` field is added incorrectly, correct the manifest and rerun validation. No irreversible migration is involved.
- If hook enforcement fails unexpectedly, run `pnpm exec tsx scripts/check-changesets.ts ...` directly with the same arguments to inspect the exact decision path.
- The only manual step outside the repo is GitHub branch protection. If that is not configured immediately, local hooks and CI still work, but merge enforcement remains incomplete until the required status check is added.

## Artifacts and Notes

- Planned workflow name: `Changesets`
- Planned required GitHub status: `Changesets / validate`
- Existing branch name during rollout: `main`

## Interfaces and Dependencies

- `@changesets/cli`
  Provides `changeset`, `changeset version`, and status commands used by contributors and automation.

- `changesets/action@v1`
  Maintains the release PR on `main`.

- `lefthook`
  Blocks local commits and pushes when the validator finds qualifying changes without a changeset.

- `tsx`
  Runs `scripts/check-changesets.ts` without introducing a new build step.

- Workspace package manifests
  Must expose stable `name`, `private`, and `version` metadata for Changesets to track them.

Revision note: 2026-03-26. Initial rollout plan created before implementation began.
Revision note: 2026-03-26. Updated after implementation to record completed milestones, validation outcomes, and the remaining branch-protection follow-up.
