# Widget Credential Storage (Phase A)

**Date:** 2026-03-17
**Status:** Approved
**Depends on:** Widget Registry spec, Widget Settings UI spec
**Phases:** A (this spec): encrypted credential storage + API key entry. B (future): OAuth flows. C (future): 1Password CLI backup/import.

## Overview

Replace `.env`-based API credential management with an encrypted database-backed credential store. Each widget declares its auth requirements in its descriptor. The settings UI widget cards show inline credential fields with test/save/disconnect controls. API routes read credentials from the store instead of `process.env`.

The only remaining `.env` secret after migration is `ENCRYPTION_KEY` (used to encrypt credentials at rest).

## WidgetDescriptor Auth Extension

Each widget descriptor gains an optional `auth` field in `packages/widgets/src/widgets/types.ts`:

```typescript
interface WidgetAuth {
  /** How this widget authenticates with its external API. */
  type: "api_key" | "oauth" | "none";
  /** For api_key: fields to show in the credential input UI. */
  fields?: WidgetAuthField[];
  /** API route to call when testing credentials (GET, returns {ok: boolean}). */
  testEndpoint?: string;
  /** URL to the service's docs page for obtaining an API key. */
  docsUrl?: string;
}

interface WidgetAuthField {
  /** Storage key within the credential record (e.g., "authToken"). */
  key: string;
  /** Display label shown above the input (e.g., "Auth Token"). */
  label: string;
  /** Input type: "password" for masked single-line, "text" for visible single-line,
   *  "textarea" for multi-line content (e.g., PEM private keys),
   *  "file" for file upload (reads content as text, stores the string). */
  type: "text" | "password" | "textarea" | "file";
  /** Placeholder text for the input. */
  placeholder?: string;
  /** Help text shown below the input. */
  helpText?: string;
  /** Accepted file extensions when type is "file" (e.g., ".p8,.pem"). */
  accept?: string;
}
```

The `WidgetDescriptor` interface adds:
```typescript
interface WidgetDescriptor<TConfig = Record<string, unknown>> {
  // ...existing fields...
  /** Auth requirements. Omit for widgets that don't need external API access. */
  auth?: WidgetAuth;
}
```

## Per-Widget Auth Declarations

| Widget | Service | Auth Type | Fields | Current Env Vars |
|---|---|---|---|---|
| Revenue | RevenueCat | `api_key` | `apiKey` (password), `projectId` (text) | `REVENUECAT_API_V2_SECRET_KEY`, `REVENUECAT_PROJECT_ID` |
| Shipping | Vercel | `api_key` | `apiKey` (password), `teamId` (text) | `VERCEL_TOKEN`, `VERCEL_TEAM_ID` |
| Shipping | Linear | `api_key` | `apiKey` (password) | `LINEAR_API_KEY` |
| Shipping | GitHub | `oauth` | -- (Phase B) | `GITHUB_TOKEN` |
| Ideas | Linear | `api_key` | (shares credential with Shipping/Linear) | `LINEAR_API_KEY` |
| Analytics | OpenPanel | `api_key` | `clientId` (text), `clientSecret` (password) | `OPENPANEL_CLIENT_ID`, `OPENPANEL_CLIENT_SECRET` |
| SEO | Google Search Console | `oauth` | -- (Phase B) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` |
| Detail (Sentry) | Sentry | `api_key` | `authToken` (password), `orgSlug` (text) | `SENTRY_AUTH_TOKEN`, `SENTRY_ORG_SLUG` |
| Detail (App Store) | App Store Connect | `api_key` | `keyId` (text), `issuerId` (text), `privateKey` (file, .p8) | `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY` |
| Detail (OC) | Open Collective | `api_key` | `apiToken` (password) | `OPENCOLLECTIVE_API_TOKEN` |
| Detail (Health) | BetterStack | `api_key` | `apiToken` (password) | `BETTERSTACK_API_TOKEN` |
| Alerts | Resend | `api_key` | `apiKey` (password), `fromEmail` (text), `toEmail` (text) | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_TO_EMAIL` |

Note: Ideas and Shipping both use Linear credentials. When stored, they share the credential key `linear` (not duplicated). The UI shows the Linear connection once but associates it with both widgets.

**Env vars NOT migrated** (infrastructure, not API credentials): `ENCRYPTION_KEY`, `BACKUP_SECRET`, `DATABASE_PROVIDER`, `TURSO_*`, `SUPABASE_*`, `PLANETSCALE_*`.

Note: Shipping and Detail widgets connect to multiple services. Each service is a separate credential entry. The widget descriptor's `auth` field handles the primary service; secondary services (e.g., Shipping's Linear + Vercel + GitHub) are declared as an array of auth configs. See the "Multi-service widgets" section below.

### Multi-service widgets

Some widgets aggregate data from multiple APIs (Shipping uses GitHub + Linear + Vercel; Detail switches between Sentry + App Store + Health). For these, the `auth` field becomes an array:

```typescript
interface WidgetDescriptor<TConfig = Record<string, unknown>> {
  // ...existing fields...
  auth?: WidgetAuth | WidgetAuth[];
}
```

When `auth` is an array, the widget card shows a credential section for each service, each with its own label, fields, test endpoint, and connection status. Credential storage keys are scoped: `{widgetId}/{serviceId}` (e.g., `shipping/vercel`, `shipping/linear`).

Each `WidgetAuth` gains an `id` and `name` field when used in arrays:
```typescript
interface WidgetAuth {
  /** Unique service identifier within this widget (required when auth is an array). */
  id?: string;
  /** Display name for this service (e.g., "Vercel", "Linear"). */
  name?: string;
  // ...existing fields...
}
```

## Credential Storage

### Encryption

All credentials are encrypted at rest using AES-256-GCM. A single `ENCRYPTION_KEY` environment variable provides the master key. This is the only remaining `.env` secret after migration.

**Encryption utility** (new file: `packages/utils/src/crypto.ts`):

```typescript
/** Encrypt a string. Returns "iv:ciphertext:tag" in base64. */
export function encrypt(plaintext: string, key: string): string;

/** Decrypt a string previously encrypted with encrypt(). */
export function decrypt(encrypted: string, key: string): string;
```

Uses Node.js built-in `crypto` module (AES-256-GCM, random 12-byte IV per encryption, 128-bit auth tag). No external dependencies.

### CredentialRepository Interface

New interface in `packages/types/src/database.ts`:

```typescript
export interface CredentialRepository {
  /** Get decrypted credentials for a widget/service. Returns null if not stored. */
  getCredential(key: string): Promise<Record<string, string> | null>;

  /** Store encrypted credentials for a widget/service. */
  setCredential(key: string, values: Record<string, string>): Promise<void>;

  /** Delete stored credentials for a widget/service. */
  deleteCredential(key: string): Promise<void>;

  /** Get all stored credential keys (without values -- for listing connected services). */
  listCredentialKeys(): Promise<string[]>;
}
```

The `key` parameter is the widget ID for single-service widgets (`"sentry"`) or `"{widgetId}/{serviceId}"` for multi-service widgets (`"shipping/vercel"`).

Encryption and decryption happen inside the repository implementation, not in the caller. The repository reads `ENCRYPTION_KEY` from the environment on initialization.

### DatabaseAdapter Extension

```typescript
export interface DatabaseAdapter {
  readonly provider: DatabaseProvider;
  cache: CacheRepository;
  settings: SettingsRepository;
  credentials: CredentialRepository;
}
```

### Database Schema

New table `widget_credentials`:

```sql
CREATE TABLE widget_credentials (
  key TEXT PRIMARY KEY,           -- "sentry" or "shipping/vercel"
  encrypted_data TEXT NOT NULL,   -- AES-256-GCM encrypted JSON
  updated_at INTEGER NOT NULL     -- Unix timestamp (seconds)
);
```

All 4 database implementations (SQLite, Supabase, Turso, PlanetScale) need this table and the `CredentialRepository` implementation.

## Widget Card UI Changes

The expanded config section of each widget card in settings gains a "Connection" section below the existing "Configuration" section.

### Disconnected state

Shows:
- Section header: "Connection"
- One input field per `WidgetAuthField` in the descriptor's `auth.fields`
- Help text below each field (from `helpText`)
- "Get your token" link (from `docsUrl`) opening in a new tab
- "Test Connection" button (calls `auth.testEndpoint`)
- "Save" button (persists to credential store)
- Both buttons disabled until all required fields are filled

### Connected state

Shows:
- Card header: green dot replaces the neutral dot, "Connected" label visible
- Section header: "Connection" with a green checkmark
- Masked credential values (last 4 characters visible, e.g., `●●●●●●sntrys_a...`)
- "Test Connection" button (re-verify)
- "Disconnect" button (deletes credentials after confirmation)

### Multi-service widgets

When a widget has an `auth` array, the Connection section shows a sub-section per service:

```
── Connection ──────────────────
  Vercel  ✓ Connected
  Linear  ✓ Connected
  GitHub  ○ Coming soon (OAuth)
```

Each sub-section expands independently to show its credential fields.

### OAuth placeholder (Phase B)

Widgets with `auth.type: "oauth"` show:
- Service name
- A disabled "Connect with {service}" button
- "Coming soon" badge
- No credential fields

## API Changes

### New routes

**`GET /api/credentials`**: Returns a list of connected service keys (no credential values). Used by the settings UI to show connection status.
```json
{ "connectedKeys": ["revenue", "shipping/vercel", "shipping/linear", "sentry"] }
```

**`POST /api/credentials`**: Save credentials for a widget/service.
```json
{ "key": "sentry", "values": { "authToken": "sntrys_...", "org": "my-org", "project": "my-project" } }
```

**`DELETE /api/credentials`**: Delete credentials for a widget/service.
```json
{ "key": "sentry" }
```

**`POST /api/credentials/test`**: Test credentials for a widget/service. The server calls the external API directly using the provided credentials (NOT through the existing API routes). Each service has a lightweight test function that makes a minimal authenticated request (e.g., Sentry: `GET /api/0/organizations/{org}/`, RevenueCat: `GET /v2/projects`). These test functions live in a new `apps/app/lib/credential-tests.ts` file.
```json
{ "key": "sentry", "values": { "authToken": "sntrys_...", "orgSlug": "my-org" } }
```
Returns: `{ "ok": true }` or `{ "ok": false, "error": "Invalid auth token" }`.

### Existing route changes

**Where credentials are actually read**: The API routes (`/api/sentry`, etc.) do NOT read `process.env` directly. They call fetcher functions in `apps/app/lib/fetchers.ts`, which call API functions in `packages/api/src/*.ts`. Those API functions have `createConfigFromEnv()` helpers that read `process.env`.

**Migration approach**: The `packages/api` package stays pure (no database dependency). Instead, the fetcher functions in `apps/app/lib/fetchers.ts` resolve credentials from the store and pass them as config to the API functions. The `createConfigFromEnv()` functions in `packages/api` remain as fallbacks but are no longer the primary path.

```typescript
// apps/app/lib/fetchers.ts (changed)
async function fetchSentryData(projectSlug: string | null) {
  const creds = await getApiCredentials("sentry");
  const config = creds
    ? { authToken: creds.authToken, orgSlug: creds.orgSlug }
    : createSentryConfigFromEnv(); // fallback to .env if no stored creds
  // ...rest of fetcher logic using config
}
```

A helper function centralizes credential resolution:
```typescript
// apps/app/lib/credential-resolver.ts
async function getApiCredentials(key: string): Promise<Record<string, string> | null> {
  const repo = getCredentialRepo();
  return repo.getCredential(key);
}
```

The `configured` flag in each route's response changes to check the credential store first, falling back to env vars.

## Credential Access Hook

New hook for widget modules that need to check connection status:

```typescript
// packages/hooks/src/use-credentials.ts
export function useCredentials(): {
  connectedKeys: string[];
  loading: boolean;
};
```

Fetches `GET /api/credentials` via SWR. Widget modules can check if their service is connected to show appropriate UI (e.g., "Connect your Sentry account to see errors").

## Future Phases

### Phase B: OAuth Flows
- Add OAuth redirect route (`/api/auth/{provider}/redirect`)
- Add OAuth callback route (`/api/auth/{provider}/callback`)
- Token exchange and storage in credential store
- Token refresh handling
- "Connect with {service}" button becomes functional
- Inspired by Handshake's self-hosted OAuth approach

### Phase C: 1Password CLI Integration
- Optional export of credentials to 1Password vault via `op` CLI
- Optional import from 1Password on first setup
- "Backup to 1Password" button in settings
- Requires `op` CLI installed and authenticated -- gracefully degrades if unavailable

## File Changes Summary

| File | Change |
|------|--------|
| `packages/widgets/src/widgets/types.ts` | Add `WidgetAuth`, `WidgetAuthField`, `auth?` field to `WidgetDescriptor` |
| `packages/utils/src/crypto.ts` | New: AES-256-GCM encrypt/decrypt functions |
| `packages/types/src/database.ts` | Add `CredentialRepository` interface, extend `DatabaseAdapter` |
| `packages/hooks/src/use-credentials.ts` | New: `useCredentials()` hook |
| `apps/app/db/schema.ts` | Add `widgetCredentials` table |
| `apps/app/db/sqlite-credentials.ts` | New: SQLite `CredentialRepository` implementation |
| `apps/app/db/supabase-credentials.ts` | New: Supabase `CredentialRepository` implementation |
| `apps/app/db/turso-credentials.ts` | New: Turso `CredentialRepository` implementation |
| `apps/app/db/planetscale-credentials.ts` | New: PlanetScale `CredentialRepository` implementation |
| `apps/app/db/repository.ts` | Add `getCredentialRepo()` factory function |
| `apps/app/app/api/credentials/route.ts` | New: GET/POST/DELETE credential endpoints |
| `apps/app/app/api/credentials/test/route.ts` | New: Test credential endpoint |
| `apps/app/components/settings-widgets.tsx` | Add Connection section to widget cards |
| `apps/app/lib/fetchers.ts` | Resolve credentials from store before calling API functions |
| `apps/app/lib/credential-resolver.ts` | New: helper to read credentials from store with env fallback |
| `apps/app/lib/credential-tests.ts` | New: per-service test functions for credential verification |
| `apps/app/app/api/open-collective/route.ts` | Pass resolved credentials to API function |
| `apps/app/app/api/ideas/route.ts` | Pass resolved credentials (shares Linear creds with shipping) |
| `apps/app/app/api/alerts/send/route.ts` | Pass resolved Resend credentials |
| All 6 widget descriptors (`widgets/*/index.tsx`) | Add `auth` field to each descriptor |

## Migration Strategy

1. Add types: `WidgetAuth`, `WidgetAuthField`, `CredentialRepository` (additive)
2. Add crypto utility (additive)
3. Add `widgetCredentials` schema + all 4 repo implementations (additive)
4. Add `getCredentialRepo()` to repository factory (additive)
5. Add credential API routes (additive)
6. Add `useCredentials` hook (additive)
7. Add `auth` field to all 6 widget descriptors (additive)
8. Update widget card UI with Connection section (UI change)
9. Migrate API routes from `process.env` to credential store (behavior change)
10. Build + typecheck + verify

Steps 1-7 are additive. Steps 8-9 are the breaking change (API routes stop reading .env).

## Testing Considerations

- Unit: encrypt/decrypt roundtrip produces original value
- Unit: CredentialRepository CRUD operations work correctly
- Unit: encrypted data in DB is not readable without key
- Unit: widget card shows credential fields based on descriptor auth
- Integration: save credentials → API route reads them → external API call succeeds
- Integration: migrate endpoint imports env vars correctly
- Integration: delete credentials → API route returns configured: false
