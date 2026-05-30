# Changesets

Radarboard uses Changesets for internal workspace versioning and release notes. This setup applies to shared workspaces under `packages/`, `widgets/`, `plugins/`, `integrations/`, and `features/`.

## When you need a changeset

Run `pnpm changeset` when your branch includes a qualifying change in an enforced workspace, including:

- Source code updates
- Export or API changes
- `package.json` updates
- Build or runtime configuration changes inside the workspace

You do not need a changeset for docs-only, tests-only, or story-only edits. Apps under `apps/*` are outside this workflow.

## Contributor workflow

1. Make your workspace change.
2. Run `pnpm changeset`.
3. Select the affected package or packages.
4. Choose the appropriate bump type.
5. Write a short release note that explains the user-visible or maintainer-visible change.

Local hooks and CI both enforce this rule. If you see `Changeset required for qualifying workspace changes. Run: pnpm changeset`, add the changeset file before committing or pushing.

## Release flow

- Changesets is configured for internal versioning only in v1.
- Packages remain `"private": true`; this setup does not publish to npm.
- Merges to `main` update or create a `Version Packages` release PR through GitHub Actions.
- Desktop package releases are opt-in through `release-notes/desktop-next.md`.
- Desktop app releases use channel-specific helpers:
  - `pnpm release:desktop:alpha` prepares the next `desktop-v*-alpha.*` candidate.
  - `pnpm release:desktop:beta` prepares the next `desktop-v*-beta.*` candidate.
  - `pnpm release:desktop:stable` promotes the current beta base to the official stable candidate.
- `pnpm release:desktop` scaffolds `release-notes/desktop-next.md` from the repo template when you want the next `Version Packages` PR to cut a package-versioned desktop release.
- When that signal file is present, `pnpm changeset:version` bumps the desktop app version, keeps `package.json`, `tauri.conf.json`, and `Cargo.toml` aligned, auto-generates `release-notes/desktop-v<desktop-version>.md` from the consumed changesets plus git author metadata, and removes `release-notes/desktop-next.md` from the generated release PR.
- Merging that release PR applies version bumps and changelog updates for affected internal workspaces.
- After the `Version Packages` PR is merged, GitHub Actions automatically validates the desktop release notes, creates the matching `desktop-v<desktop-version>` tag, and triggers the macOS DMG release workflow.
- Before merging the release PR, review the checked-in `release-notes/<tag>.md` file. It is generated automatically, but you can still add a short curated summary above the generated block if needed.

## Required GitHub protection

GitHub branch protection for `main` must require the `Changesets / validate` status check. That setting is external to the repository, so it must be configured in GitHub after this rollout lands.

The `Changesets / release` push job also needs permission to create the `Version Packages` pull request. Either enable `Allow GitHub Actions to create and approve pull requests` for the repository or organization, or add a fine-grained release bot token named `CHANGESETS_GITHUB_TOKEN` with contents and pull request write access. The workflow uses that token when present and falls back to `GITHUB_TOKEN`.
