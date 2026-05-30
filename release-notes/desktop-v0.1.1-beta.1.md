# Radarboard Desktop desktop-v0.1.1-beta.1

First public desktop beta for validating Radarboard's local-first Mac distribution path.

## Highlights

- Ships the first GitHub-hosted Radarboard desktop prerelease from the new `Radarboard/radarboard` repository.
- Publishes macOS beta artifacts and updater metadata for release-channel validation.
- Enables the beta Homebrew cask flow through `Radarboard/homebrew-radarboard`.

## Install notes

- This is a beta release for macOS testers.
- Download the DMG from the GitHub prerelease once the workflow publishes artifacts.
- Homebrew beta installs use the public tap after the cask sync PR is merged:
  `brew tap Radarboard/radarboard https://github.com/Radarboard/homebrew-radarboard`.
