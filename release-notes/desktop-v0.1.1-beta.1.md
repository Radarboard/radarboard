# Radarboard Desktop desktop-v0.1.1-beta.1

First desktop beta candidate for validating Radarboard's local-first Mac distribution path.

## Highlights

- Validates version alignment across the desktop package, Tauri config, and Cargo metadata.
- Exercises the signed desktop release path before publishing public GitHub artifacts.
- Prepares the beta Homebrew cask workflow without updating the tap during this dry run.

## Install notes

- This candidate is for local dry-run validation only.
- No GitHub tag, prerelease, updater metadata, or Homebrew cask is published by this pass.
- Published beta downloads should appear on the marketing site only after a public `desktop-v*-beta.*`
  GitHub prerelease exists.
