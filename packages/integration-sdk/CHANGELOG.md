# @radarboard/integration-sdk

## 0.2.0

### Minor Changes

- 063de84: Add a declarative REST integration factory and provider-based credential grouping.
  - `createRestIntegration({ baseUrl, auth, dataSources, provider })` generates a full `IntegrationDescriptor` — each data source's `fetch` (credential resolve + auth header + error handling) and a credential test — so simple REST/api-key integrations are ~1 config instead of ~300 lines of boilerplate. Exotic integrations keep hand-writing descriptors.
  - New helpers `authHeader` and `createHttpCredentialTest`.
  - Optional `provider` on `IntegrationAuth`: integrations sharing a provider resolve credentials from one stored key (`provider ?? id`), so one connected provider satisfies all of them. Defaults to `id`, so existing behavior is unchanged.

- 449a71e: Support no-code, user-defined REST integrations. `createRestIntegration` now supports `scheme: "none"` for public/no-auth APIs — the data source fetches without resolving or requiring a credential (auth type resolves to `"none"` with no credential fields). The SDK registry also exposes `unregisterIntegration(id)` so a re-registered descriptor (e.g. a live-updated user integration) can take effect without a restart. The `SettingsRepository` contract gains `getUserIntegrations`/`setUserIntegrations`, backed by a new `user_integrations` column, so serializable integration configs persist and re-register on boot.

### Patch Changes

- 520b374: Add integration registry edge-case coverage and adjust dialog overlay behavior.
- 520b374: Initialize Changesets-based internal version tracking, release-note enforcement, and release PR automation for Radarboard shared workspaces.
- f83fd04: Refresh direct dependency ranges and lockfiles across the workspace, and document the alpha, beta, and official desktop release flow.
- 520b374: Roll out shared Vitest configuration across internal workspaces, add targeted test coverage, and align package manifests with the new test setup.
- Updated dependencies [520b374]
- Updated dependencies [520b374]
- Updated dependencies [449a71e]
- Updated dependencies [520b374]
- Updated dependencies [520b374]
  - @radarboard/types@0.2.0
