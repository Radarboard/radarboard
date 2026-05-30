# ExecPlan: Desktop macOS Notarized Release

Date: 2026-03-27

## Goal

Convert the macOS release workflow from "builds unsigned artifacts" to "produces a signed, notarized, distributable app and DMG" while keeping the CI workflow as unsigned internal smoke artifacts.

## Scope

- update `desktop-macos-release.yml` to import a Developer ID certificate, derive a signing identity, notarize the app, and fail fast when secrets are missing
- keep `desktop-macos-ci.yml` unsigned and clearly internal-only
- update desktop release docs to distinguish unsigned CI artifacts from real release artifacts

## Validation

- workflow syntax stays valid
- docs match the actual workflow behavior
- release workflow supports either:
  - Apple ID + app-specific password + team ID
  - App Store Connect API key notarization auth

## Risks

- Apple secret naming or key import mistakes can break release builds
- notarization can fail if certificate identity does not match the repo bundle identifier or team
- existing docs currently overstate updater/signing guarantees and must be corrected atomically with the workflow
