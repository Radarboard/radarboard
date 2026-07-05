# @radarboard/types

## 0.2.0

### Minor Changes

- 449a71e: Support no-code, user-defined REST integrations. `createRestIntegration` now supports `scheme: "none"` for public/no-auth APIs — the data source fetches without resolving or requiring a credential (auth type resolves to `"none"` with no credential fields). The SDK registry also exposes `unregisterIntegration(id)` so a re-registered descriptor (e.g. a live-updated user integration) can take effect without a restart. The `SettingsRepository` contract gains `getUserIntegrations`/`setUserIntegrations`, backed by a new `user_integrations` column, so serializable integration configs persist and re-register on boot.

### Patch Changes

- 520b374: Initialize Changesets-based internal version tracking, release-note enforcement, and release PR automation for Radarboard shared workspaces.
- 520b374: Add uniform grid layouts (4x3, 4x4), Connect CTAs on empty widget slots, and settings badge for setup progress. Extract onboarding wizard into @radarboard/feature-onboarding package. Add 94%+ unit test coverage and fix e2e tests for 7-step wizard.
- 520b374: Add workspace test coverage and align dashboard settings access with the dock entry point
- 520b374: Roll out shared Vitest configuration across internal workspaces, add targeted test coverage, and align package manifests with the new test setup.
