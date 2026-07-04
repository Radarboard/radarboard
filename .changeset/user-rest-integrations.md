---
"@radarboard/integration-sdk": minor
"@radarboard/types": minor
---

Support no-code, user-defined REST integrations. `createRestIntegration` now supports `scheme: "none"` for public/no-auth APIs — the data source fetches without resolving or requiring a credential (auth type resolves to `"none"` with no credential fields). The SDK registry also exposes `unregisterIntegration(id)` so a re-registered descriptor (e.g. a live-updated user integration) can take effect without a restart. The `SettingsRepository` contract gains `getUserIntegrations`/`setUserIntegrations`, backed by a new `user_integrations` column, so serializable integration configs persist and re-register on boot.
