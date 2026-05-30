# Releasing Radarboard Desktop

This document is the canonical release playbook for the Radarboard desktop app.

It covers five different states:

1. Alpha builds
2. Beta releases
3. Stable releases with updater support
4. Homebrew cask distribution
5. Future Apple-backed distribution

The macOS workflows referenced here live in:

- [desktop-macos-ci.yml](/Users/thedaviddias/Projects/radarboard/.github/workflows/desktop-macos-ci.yml)
- [desktop-macos-release.yml](/Users/thedaviddias/Projects/radarboard/.github/workflows/desktop-macos-release.yml)

## Current State

Today the repository supports three practical macOS paths:

- unsigned CI builds and alpha prereleases for internal use, testers, and rapid iteration
- signed + notarized GitHub prereleases for beta testers
- signed + notarized GitHub releases for real direct-download distribution
- custom Homebrew tap updates driven from published beta and stable desktop releases

The repository still does not have a Mac App Store release workflow.

## Release Channels

Radarboard desktop releases use the version and tag to define the channel.

| Channel | Version format | Tag format | GitHub release | Homebrew |
| --- | --- | --- | --- | --- |
| Alpha | `0.2.0-alpha.1` | `desktop-v0.2.0-alpha.1` | Draft prerelease or CI artifacts | No cask update |
| Beta | `0.2.0-beta.1` | `desktop-v0.2.0-beta.1` | Prerelease | `radarboard-beta` |
| Stable | `0.2.0` | `desktop-v0.2.0` | Normal release | `radarboard` |

Important updater behavior:

- Stable installed apps check `https://github.com/Radarboard/radarboard/releases/latest/download/latest.json`.
- GitHub latest release resolution does not make prereleases the stable latest release.
- Beta releases are for direct download and `radarboard-beta` Homebrew testers unless a separate beta updater endpoint is added later.

## Release Paths

### 1. Alpha Builds

Use this when:

- you want fast artifacts for internal use
- you want testers to validate the app before a public release
- you do not need Homebrew or the stable updater channel

What happens:

- for the fastest path, GitHub Actions runs `Desktop macOS CI` and uploads unsigned artifacts
- for a tagged alpha, `pnpm release:desktop:alpha` prepares `desktop-v<version>-alpha.<n>` and the normal desktop release workflow creates a draft prerelease

Tradeoffs:

- unsigned CI artifacts can trigger Gatekeeper warnings
- tagged alpha prereleases follow the same release automation as beta and stable releases, but do not update Homebrew
- this is not the right path for broad public distribution

### 2. Beta Releases

Use this when:

- you want to validate the real signed and notarized install path
- you want a GitHub prerelease for testers
- you want a `radarboard-beta` Homebrew cask in the custom tap

What happens:

- prepare a version such as `0.2.0-beta.1`
- create curated release notes at `release-notes/desktop-v0.2.0-beta.1.md`
- push tag `desktop-v0.2.0-beta.1` or run `Desktop macOS Release`
- the release workflow marks the GitHub release as a prerelease
- after the release is published, the tap sync workflow updates `Casks/radarboard-beta.rb`

Tradeoffs:

- beta releases do not update the stable `radarboard` cask
- beta releases are not the default stable updater channel

### 3. Stable Direct-Download Releases With Updater Support

Use this when:

- you want people to download a DMG from GitHub Releases
- you want installed apps to discover future releases through the updater
- you want a release that opens normally on macOS without the “damaged” Gatekeeper path

What happens:

- GitHub Actions runs `Desktop macOS Release`
- the workflow imports a Developer ID Application certificate
- the workflow signs the Apple Silicon `.app` and `.dmg`
- the workflow notarizes the macOS bundle with Apple
- the workflow staples the notarization ticket as part of the Tauri release flow
- the workflow signs updater metadata with the Tauri updater signing key
- a draft GitHub release is created for a `desktop-v*` tag

This is the default public distribution path for Radarboard right now.

Important limitation:

- the updater only sees published releases, not drafts

### 4. Homebrew Cask Distribution

Use this when:

- you want `brew install --cask <tap>/radarboard`
- you want beta testers to use `brew install --cask <tap>/radarboard-beta`
- you want Homebrew to handle first install while the app handles later in-place updates
- you want a custom tap you control instead of waiting on Homebrew core

What happens:

- GitHub Actions runs `Desktop Homebrew Tap Sync` after a `desktop-v*` release is published
- the workflow downloads the published notarized DMG asset
- it computes the DMG SHA-256
- it writes `Casks/radarboard.rb` for stable releases
- it writes `Casks/radarboard-beta.rb` for beta prereleases
- it commits and pushes the cask update to that tap

Important limitation:

- the tap is only updated after the GitHub release is published, not while it is still a draft
- alpha prereleases do not update Homebrew
- beta prereleases do not update the stable Homebrew cask

### 5. Future Apple-Backed Distribution

Use this when:

- you want notarization for smoother Gatekeeper behavior
- you want a future Mac App Store path

Important:

- this requires an Apple-specific release pass
- notarized direct download and Mac App Store distribution are different Apple paths
- the current repository is not yet wired for that flow

## Quick Decision Guide

Choose alpha / `Desktop macOS CI` if:

- you only need unsigned artifacts
- you are validating the app internally
- you want the fastest path with no release secrets

Choose beta / `Desktop macOS Release` with a `desktop-v*-beta.*` tag if:

- you want signed and notarized tester builds
- you want to validate Homebrew beta installation
- you do not want stable users to receive the build

Choose stable / `Desktop macOS Release` with a `desktop-v*` tag if:

- you want to ship a public direct download
- you want updater-backed releases
- you want a signed + notarized macOS build

Choose a future Apple-backed workflow if:

- you want notarization or App Store distribution later

## Unsigned Test Build Checklist

1. Open the `Desktop macOS CI` workflow run.
2. Download the `radarboard-macos-app` or `radarboard-macos-dmg` artifact.
3. Give the artifact to internal testers only.
4. Expect Gatekeeper warnings on first launch.

## End-to-End Alpha Checklist

Use the CI-artifact path when speed matters more than release metadata:

1. Run the desktop CI workflow manually or open the latest `Desktop macOS CI` run from `main`.
2. Download the `radarboard-macos-dmg` artifact.
3. Share only with trusted internal testers.
4. Do not publish a GitHub release and do not update Homebrew.

Use the tagged alpha path when testers need a GitHub prerelease and the same release checks used by beta:

1. Prepare the alpha version:

   ```bash
   pnpm release:desktop:alpha
   ```

   This computes the next alpha automatically. For example, `0.1.0` becomes
   `0.1.1-alpha.1`, and `0.1.1-alpha.1` becomes `0.1.1-alpha.2`.
   Use `pnpm release:desktop:alpha -- --version <version>` only when the automatic candidate is
   not the version you want.

2. Edit `release-notes/desktop-v<version>.md` until it contains real notes for internal testers.
3. Dry-run the candidate:

   ```bash
   pnpm release:desktop:dry-run
   ```

4. Commit the version and release-note changes.
5. Merge the commit to `main`. The `Changesets` workflow validates the candidate and creates
   `desktop-v<version>` automatically.
6. Wait for `Desktop macOS Release`.
7. Inspect the draft prerelease, download the DMG, and test install.
8. Publish only if the alpha should be visible as a GitHub prerelease.
9. Do not expect a Homebrew cask update for alpha releases.

## End-to-End Beta Checklist

1. Prepare the beta version:

   ```bash
   pnpm release:desktop:beta
   ```

   This computes the next beta automatically. For example, `0.1.0` becomes
   `0.1.1-beta.1`, and `0.1.1-beta.1` becomes `0.1.1-beta.2`.
   Use `pnpm release:desktop:beta -- --version <version>` only when the automatic candidate is
   not the version you want.

2. Edit the generated `release-notes/desktop-v<version>.md` until it contains real curated notes.
3. Dry-run the candidate:

   ```bash
   pnpm release:desktop:dry-run
   ```

4. Commit the version and release-note changes.
5. Merge the commit to `main`. The `Changesets` workflow validates the desktop candidate and
   creates `desktop-v<version>` automatically.

   If you need to exercise the tag creation path manually for the current committed candidate,
   run the `Changesets` workflow in GitHub Actions with `create_desktop_tag` enabled.

6. Do not create the tag locally unless the GitHub Actions path is unavailable. The fallback command
   is:

   ```bash
   git tag desktop-v<version>
   git push origin desktop-v<version>
   ```

7. Wait for `Desktop macOS Release`.
8. Inspect the draft prerelease, download the DMG, and test install on a clean macOS account or machine.
9. Publish the prerelease when ready.
10. Confirm `Desktop Homebrew Tap Sync` updates `Casks/radarboard-beta.rb`.
11. Test the tap:

    ```bash
    brew install --cask <tap>/radarboard-beta
    ```

## End-to-End Stable Checklist

1. Promote the current beta base to a stable version:

   ```bash
   pnpm release:desktop:stable
   ```

   For example, `0.1.1-beta.2` becomes `0.1.1`.
   Use `pnpm release:desktop:stable -- --version <version>` only when promoting a different
   stable version intentionally.

2. Edit the generated `release-notes/desktop-v<version>.md` until it contains real curated notes.
3. Dry-run the candidate:

   ```bash
   pnpm release:desktop:dry-run
   ```

4. Commit the version and release-note changes.
5. Merge the commit to `main`. The `Changesets` workflow validates the desktop candidate and
   creates `desktop-v<version>` automatically.

   If you need to exercise the tag creation path manually for the current committed candidate,
   run the `Changesets` workflow in GitHub Actions with `create_desktop_tag` enabled.

6. Do not create the tag locally unless the GitHub Actions path is unavailable. The fallback command
   is:

   ```bash
   git tag desktop-v<version>
   git push origin desktop-v<version>
   ```

7. Wait for `Desktop macOS Release`.
8. Inspect the draft release, download the DMG, and test install/update.
9. Publish the release when ready.
10. Confirm `Desktop Homebrew Tap Sync` updates `Casks/radarboard.rb`.
11. Test the tap:

    ```bash
    brew install --cask <tap>/radarboard
    ```

## Release Automation Requirements

The `Changesets` workflow owns the handoff from committed release candidate to desktop tag:

1. `Changesets / validate` checks that workspace changes have release notes.
2. `Changesets / release` creates or updates the `Version Packages` PR.
3. `Changesets / desktop-tag` creates `desktop-v<version>` after the candidate lands on `main`.
4. `Desktop macOS Release` creates the draft GitHub release from that tag.
5. `Desktop Homebrew Tap Sync` updates the beta or stable cask after a maintainer publishes the release.

For step 2, GitHub must allow the token used by Actions to create pull requests. Use one of these setups:

- Enable the repository or organization setting `Allow GitHub Actions to create and approve pull requests`.
- Or create a fine-grained release bot token with contents and pull request write access, then store it as `CHANGESETS_GITHUB_TOKEN`.

The workflow uses `CHANGESETS_GITHUB_TOKEN` when present and falls back to the standard `GITHUB_TOKEN`.

## Public Direct-Download Setup Checklist

### One-time Setup

1. Keep the updater private key somewhere safe. If you lose it, existing installs will stop trusting future updates.

How to obtain it:

- updater signing key
  In this repository, the local updater signing key currently lives at `apps/desktop/.tauri/radarboard-updater.key` and is ignored by git.

### One-time GitHub Setup

Add these GitHub secrets for the repository:

- `APPLE_CERTIFICATE`
  Base64-encoded `.p12` Developer ID Application certificate exported from Keychain Access.
- `APPLE_CERTIFICATE_PASSWORD`
  Password used when exporting the `.p12` certificate.
- `KEYCHAIN_PASSWORD`
  Temporary keychain password used on the GitHub macOS runner.
- `TAURI_SIGNING_PRIVATE_KEY`
  Private updater signing key contents used by Tauri to sign update metadata.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  Optional updater signing key password if the private key is encrypted. Leave unset if the key has no password.
- `HOMEBREW_TAP_GITHUB_TOKEN`
  Fine-grained GitHub token with contents write access to the custom tap repository.

Add this GitHub Actions repository variable:

- `HOMEBREW_TAP_REPOSITORY`
  Full owner/name for the custom tap repository, for example `radarboard/homebrew-tap`.

For notarization, configure one of these two auth sets:

- Apple ID auth:
  - `APPLE_ID`
  - `APPLE_PASSWORD`
  - `APPLE_TEAM_ID`
- App Store Connect API key auth:
  - `APPLE_API_ISSUER`
  - `APPLE_API_KEY`
  - `APPLE_API_PRIVATE_KEY`

### Where To Get Each Secret

#### Signing certificate

- `APPLE_CERTIFICATE`
  Export your `Developer ID Application` certificate from Keychain Access as a `.p12`, then base64-encode the file for GitHub Actions.
  Source:
  - Create/download certificate: Apple Developer Certificates, Identifiers & Profiles → Certificates → `Developer ID Application`
  - Export from Keychain Access after installing the downloaded `.cer`

  Example on macOS:

  ```bash
  base64 -i /path/to/radarboard-developer-id.p12 | pbcopy
  ```

- `APPLE_CERTIFICATE_PASSWORD`
  This is the password you set when exporting the `.p12` from Keychain Access.

- `KEYCHAIN_PASSWORD`
  This is not issued by Apple. Create a strong random password just for the temporary CI keychain.

  Example:

  ```bash
  openssl rand -base64 24
  ```

#### Updater signing key

- `TAURI_SIGNING_PRIVATE_KEY`
  Contents of the local updater key file:

  ```bash
  cat /Users/thedaviddias/Projects/radarboard/apps/desktop/.tauri/radarboard-updater.key | pbcopy
  ```

- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  Only set this if the updater key is encrypted. Leave it unset if the key has no password.

#### Option A: Apple ID notarization auth

- `APPLE_ID`
  Your Apple Account email used for Apple Developer/App Store Connect access.

- `APPLE_PASSWORD`
  An Apple app-specific password created at `account.apple.com` under `Sign-In and Security` → `App-Specific Passwords`.
  Do not use your normal Apple Account password here.

- `APPLE_TEAM_ID`
  Your 10-character Apple Developer Team ID.
  Source: Apple Developer account → `Membership details`.

#### Option B: App Store Connect API key notarization auth

- `APPLE_API_ISSUER`
  The App Store Connect API issuer ID shown in App Store Connect.
  Source: App Store Connect → `Users and Access` → `Integrations` → App Store Connect API.

- `APPLE_API_KEY`
  The API key ID.
  Source: same Integrations page when you create or view the key metadata.

- `APPLE_API_PRIVATE_KEY`
  Contents of the downloaded `.p8` private key file for that App Store Connect API key.
  Apple only lets you download this file once.

  Example:

  ```bash
  cat /path/to/AuthKey_XXXXXX.p8 | pbcopy
  ```

#### Which auth set to prefer

- Prefer the App Store Connect API key set for CI if you have it. It is narrower and avoids coupling the workflow to a personal Apple ID login.
- Use the Apple ID set only if you do not have App Store Connect API access yet.

Use the local ignored key file for `TAURI_SIGNING_PRIVATE_KEY`:

```bash
cat /Users/thedaviddias/Projects/radarboard/apps/desktop/.tauri/radarboard-updater.key | pbcopy
```

For local desktop builds, `pnpm --filter @radarboard/desktop build:desktop` now runs the signed Tauri `.app` bundle first and then creates the `.dmg` via the repo-owned `scripts/build-dmg.mjs` wrapper.

### Per-release Steps

1. Make sure the desktop version numbers are correct in:
   - [apps/desktop/package.json](/Users/thedaviddias/Projects/radarboard/apps/desktop/package.json)
   - [apps/desktop/src-tauri/tauri.conf.json](/Users/thedaviddias/Projects/radarboard/apps/desktop/src-tauri/tauri.conf.json)
   - [apps/desktop/src-tauri/Cargo.toml](/Users/thedaviddias/Projects/radarboard/apps/desktop/src-tauri/Cargo.toml)
2. If you want the next `Version Packages` PR to produce a desktop DMG release, add the desktop release signal file before that PR is generated:

```bash
pnpm release:desktop
```

This creates `release-notes/desktop-next.md`, which acts as the opt-in signal for the next desktop release.

3. Make sure the resulting `Version Packages` release PR includes the generated release notes file for the desktop tag and the bumped desktop version files.

If you need to regenerate or replace the versioned notes locally after `pnpm changeset:version`, run:

```bash
pnpm release:notes:generate --tag desktop-v0.1.0
```

When `release-notes/desktop-next.md` is present, the Changesets release flow bumps the desktop app version and auto-generates `release-notes/desktop-v<desktop-version>.md` from the consumed changesets and git author metadata when `pnpm changeset:version` produces a `Version Packages` PR. The signal file is then removed from the generated release PR.

You can optionally add a short curated intro above the generated section before merging the release PR.

Guidelines:

- summarize the full Radarboard product story, not just the desktop binary
- use Changesets as the source of truth for package-level details
- keep package-by-package detail out of the top sections unless it matters to builders
- use inline `Thanks @name` only for standout or community-facing contributions
- add a `Thanks` section when the release includes contributors beyond a solo release

4. Merge the `Version Packages` PR.
5. Wait for the `Changesets` workflow on `main` to validate the release notes and create the matching `desktop-v<version>` tag automatically.
6. Wait for `Desktop macOS Release` to finish.
7. Open the draft GitHub release created by the workflow.
8. Confirm the release body starts with the curated notes from `release-notes/<tag>.md` and then includes GitHub's generated notes.
9. If the workflow fails before publishing, check whether the release notes file still contains template placeholder text.
10. Confirm the release contains updater metadata such as `latest.json`.
11. Download and test the DMG on a clean Mac.
12. Publish the draft release when validation is complete. The in-app updater will not see the new version until the release is published.
13. Confirm `Desktop Homebrew Tap Sync` updates the custom tap after the release is published.

### Automated GitHub Actions Chain

The normal automation chain is:

1. A committed desktop candidate lands on `main`.
2. `.github/workflows/changesets.yml` runs on the `main` push.
3. The `desktop-tag` job reads the desktop version, runs `pnpm release:desktop:dry-run`, checks local
   and remote tags, and pushes `desktop-v<version>` if the candidate is valid.
4. `.github/workflows/desktop-macos-release.yml` runs from the tag and creates a draft GitHub release.
5. A maintainer tests the draft DMG and publishes the GitHub release.
6. `.github/workflows/desktop-homebrew-tap-sync.yml` runs on the published release and updates the
   matching Homebrew cask.

The `Changesets` workflow also has a manual `create_desktop_tag` input. Use it only when the current
committed candidate should be tagged from GitHub Actions without waiting for another `main` push.

### Validation Before Publishing

Verify:

- the app opens normally on a clean Mac without a quarantine bypass or security override
- the DMG mounts cleanly
- the app launches on a machine that has never seen the build before
- the bundle version shown in Finder matches the intended release
- the release contains signed updater metadata

## Future Apple-Backed Distribution Checklist

Do not use the default unsigned direct-download workflow for this.

When Radarboard is ready for notarized direct download or the Mac App Store, do a dedicated pass that covers:

1. Decide whether the target is notarized direct download or the Mac App Store.
2. Add Apple release credentials and code-signing material.
3. Verify the bundle identifier, signing mode, entitlements, and capabilities for that Apple path.
4. Audit Tauri configuration and plugins for Apple restrictions.
5. Build with Apple signing enabled instead of `--no-sign`.
6. If using the Mac App Store, submit through App Store Connect and pass App Review.

## Radarboard-Specific Apple Distribution Risks To Audit Later

These need explicit review before notarized or App Store distribution:

- `macOSPrivateApi: true` in [tauri.conf.json](/Users/thedaviddias/Projects/radarboard/apps/desktop/src-tauri/tauri.conf.json)
- any plugin or runtime behavior that conflicts with App Sandbox expectations
- deep linking, auto-start, global shortcuts, process inspection, and local sidecar behavior
- whether the current sidecar-hosted Next.js architecture is acceptable for App Store review

This does not mean Apple distribution is impossible. It means the current unsigned direct-download configuration should not be assumed Apple-ready without a focused audit.

## Versioning Reminder

Before any public release, keep these versions aligned:

- `apps/desktop/package.json`
- `apps/desktop/src-tauri/tauri.conf.json`
- `apps/desktop/src-tauri/Cargo.toml`

If they drift, release artifacts and app metadata can disagree.

## References

- Apple Developer ID certificates:
  [developer.apple.com/help/account/certificates/create-developer-id-certificates](https://developer.apple.com/help/account/certificates/create-developer-id-certificates)
- Apple Developer ID glossary:
  [developer.apple.com/help/glossary/developer-id-certificate](https://developer.apple.com/help/glossary/developer-id-certificate)
- Apple macOS distribution overview:
  [developer.apple.com/macos/distribution](https://developer.apple.com/macos/distribution/)
- Apple App Store Connect provisioning profile for macOS:
  [developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile](https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile)
- Apple Support on opening non-notarized / unidentified apps:
  [support.apple.com/en-tj/102445](https://support.apple.com/en-tj/102445)
Local release helpers:
- `pnpm build:desktop` builds the app bundle and DMG without resetting local data.
- `pnpm build:desktop:fresh-install` builds, installs to `/Applications`, and resets Radarboard’s local data directories after backing them up. Use this only for first-run regression checks.
