---
"@radarboard/integration-sdk": minor
---

Add a declarative REST integration factory and provider-based credential grouping.

- `createRestIntegration({ baseUrl, auth, dataSources, provider })` generates a full `IntegrationDescriptor` — each data source's `fetch` (credential resolve + auth header + error handling) and a credential test — so simple REST/api-key integrations are ~1 config instead of ~300 lines of boilerplate. Exotic integrations keep hand-writing descriptors.
- New helpers `authHeader` and `createHttpCredentialTest`.
- Optional `provider` on `IntegrationAuth`: integrations sharing a provider resolve credentials from one stored key (`provider ?? id`), so one connected provider satisfies all of them. Defaults to `id`, so existing behavior is unchanged.
