# OAuth Flows (Phase B)

**Date:** 2026-03-17
**Status:** Approved
**Depends on:** Widget Credentials spec (Phase A)

## Overview

Add OAuth 2.0 Authorization Code flows for GitHub and Google Search Console. Built from scratch (no external OAuth library). OAuth client credentials (client ID, client secret) are stored in the encrypted credential store alongside user tokens -- the user creates their own OAuth app and enters the credentials in the widget settings UI.

For Google specifically, an alternative CLI-based setup via `@googleworkspace/cli` (`gws`) is supported as an optional shortcut.

## OAuth Providers

| Provider | Token Needed | Scopes | Auth URL | Token URL |
|---|---|---|---|---|
| **GitHub** | `access_token` (Bearer) | `repo` or `public_repo` | `https://github.com/login/oauth/authorize` | `https://github.com/login/oauth/access_token` |
| **Google** | `refresh_token` (existing GSC client auto-refreshes) | `https://www.googleapis.com/auth/webmasters.readonly` | `https://accounts.google.com/o/oauth2/v2/auth` | `https://oauth2.googleapis.com/token` |

## Connection Paths

### Path 1: Web OAuth Flow (primary)

The standard browser-based OAuth redirect:

```
User clicks "Connect"
  → GET /api/auth/{provider}/redirect
    → Server generates state, stores in httpOnly cookie
    → Redirects to provider's authorization URL
      → User authorizes on provider's site
        → Provider redirects to /api/auth/{provider}/callback?code=X&state=Y
          → Server verifies state, reads client_id/secret from credential store
          → POST code → provider's token URL
          → Store token encrypted in credential store
          → Redirect → /settings?oauth=success&provider={provider}
```

### Path 2: CLI Setup via `gws` (Google only, optional)

For developers who prefer the terminal:

```bash
# One-time setup (creates GCP project, enables APIs)
npx @googleworkspace/cli auth setup

# Login with Search Console scope
npx @googleworkspace/cli auth login -s webmasters
```

Then in the widget settings UI, click "Import from gws CLI" to read the stored tokens from `~/.config/gws/` and import them into the credential store.

### Path 3: Manual Token Entry (fallback)

Paste tokens directly into credential fields. Already supported via the existing api_key pattern. For Google, the user enters client_id, client_secret, and refresh_token manually (same as the current .env approach).

## WidgetAuth Type Extension

```typescript
interface WidgetAuth {
  // ...existing fields (id, name, type, fields, testEndpoint, docsUrl)
  
  /** OAuth-specific config. Required when type === "oauth". */
  oauth?: {
    /** Provider key used in route paths (e.g., "github", "google") */
    provider: string;
    /** Scopes to request during authorization */
    scopes: string[];
    /** Instructions shown above the client credential fields */
    setupInstructions?: string;
  };
}
```

When `type === "oauth"`, the widget card shows:
1. Client ID + client secret fields (same as api_key pattern -- these are the user's OAuth app credentials)
2. Setup instructions (e.g., "Create an OAuth App at github.com/settings/developers")
3. "Connect with {provider}" button (enabled only when client credentials are saved)
4. Connection status after OAuth completes

## OAuth Provider Registry

Server-side static config defining provider URLs. Not user-facing.

```typescript
// apps/app/lib/oauth-providers.ts
interface OAuthProviderConfig {
  authorizationUrl: string;
  tokenUrl: string;
  /** How to map the token response to stored credential fields */
  tokenMapping: {
    accessTokenField: string;
    refreshTokenField?: string;
  };
  /** Additional params to include in the authorization URL */
  authParams?: Record<string, string>;
}

const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  github: {
    authorizationUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    tokenMapping: { accessTokenField: "access_token" },
  },
  google: {
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    tokenMapping: {
      accessTokenField: "access_token",
      refreshTokenField: "refresh_token",
    },
    authParams: {
      access_type: "offline",
      prompt: "consent",
    },
  },
};
```

Adding a new OAuth provider = add one entry here + one `WidgetAuth` descriptor with `oauth` config.

## API Routes

### `GET /api/auth/[provider]/redirect`

Initiates the OAuth flow.

1. Read `provider` from path params
2. Look up provider config in `OAUTH_PROVIDERS`
3. Read the credential key from `credKey` query param (e.g., `shipping/github`)
4. Read `clientId` from credential store using that key
5. Generate random 32-byte `state` value
6. Store state + credential key in httpOnly cookies (`oauth_state`, `oauth_cred_key`, max-age: 300s, sameSite: lax, secure in production)
7. Construct `redirect_uri`: `{request.origin}/api/auth/{provider}/callback`
8. Build authorization URL: `authorizationUrl?client_id=X&redirect_uri=Y&scope=Z&state=S` (plus any `authParams` from provider config)
9. Redirect user to authorization URL

### `GET /api/auth/[provider]/callback`

Receives the authorization code and exchanges it for tokens.

1. Read `code` and `state` from query params. If `error` param is present, skip to error redirect.
2. Read `oauth_state` and `oauth_cred_key` from cookies
3. Verify `state === oauth_state` (CSRF protection). If mismatch, return 403.
4. Read `clientId` and `clientSecret` from credential store using `oauth_cred_key`
5. Reconstruct `redirect_uri` from `request.origin` -- **must exactly match** the one sent in the redirect step
6. POST to provider's token URL with: `code`, `client_id`, `client_secret`, `redirect_uri`, `grant_type=authorization_code`
7. Parse token response per `tokenMapping`
8. **Read-merge-write** the credential record: read existing record (which has `clientId`, `clientSecret`), merge the new token fields (`token` and/or `refreshToken`) into it, then write back. This preserves client credentials alongside the tokens.
9. For Google: only store `refreshToken` (not `access_token`). The existing GSC client handles access token refresh from the refresh token automatically. For GitHub: store `token` (the access token, which does not expire for classic OAuth Apps).
10. Clear the state cookies
11. Redirect to `/settings?oauth=success&provider={provider}`

**Error handling**: If the provider returns an `error` query param (user denied, expired code, etc.), redirect to `/settings?oauth=error&provider={provider}&error={error_description}`.

**GitHub token model**: This spec targets GitHub **OAuth Apps** (classic), which issue non-expiring access tokens. GitHub App tokens (fine-grained, expiring) are not supported in this version. If a stored token is revoked, API calls will fail with 401 -- the widget will show an error state and the user can reconnect.

### `POST /api/auth/gws-import` (Google only)

Imports tokens from the `gws` CLI config directory.

1. Read `~/.config/gws/credentials.json` (or the path specified by `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` env var)
2. Parse the JSON file. Expected structure: `{ client_id, client_secret, refresh_token, ... }`
3. If the file doesn't exist or can't be parsed, return `{ imported: false, error: "gws CLI credentials not found" }`
4. Read existing credential record for `seo/google-search-console` (may already have user-entered client ID/secret)
5. Merge: `{ clientId: file.client_id, clientSecret: file.client_secret, refreshToken: file.refresh_token }` (import all three -- this is a complete shortcut, no separate client credential entry needed)
6. Store merged record in credential store
7. Return `{ imported: true }`

This route runs server-side and accesses the filesystem. Only works for local/self-hosted deployments (not serverless). Fails gracefully on serverless platforms.

## Widget Descriptor Changes

### GitHub (in shipping/index.tsx)

```typescript
auth: [
  // ...existing vercel, linear auth...
  {
    id: "github",
    name: "GitHub",
    type: "oauth",
    fields: [
      { key: "clientId", label: "Client ID", type: "text" },
      { key: "clientSecret", label: "Client Secret", type: "password" },
    ],
    docsUrl: "https://github.com/settings/developers",
    oauth: {
      provider: "github",
      scopes: ["repo"],
      setupInstructions: "Create an OAuth App at github.com/settings/developers. Set the callback URL to: {origin}/api/auth/github/callback",
    },
  },
]
```

### Google Search Console (in seo/index.tsx)

```typescript
auth: {
  id: "google-search-console",
  name: "Google Search Console",
  type: "oauth",
  fields: [
    { key: "clientId", label: "Client ID", type: "text" },
    { key: "clientSecret", label: "Client Secret", type: "password" },
  ],
  docsUrl: "https://console.cloud.google.com/apis/credentials",
  oauth: {
    provider: "google",
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    setupInstructions: "Create OAuth credentials in Google Cloud Console. Enable the Search Console API. Set the callback URL to: {origin}/api/auth/google/callback",
  },
},
```

## Settings UI Changes

The "Coming soon" badge for OAuth widgets is replaced with:

### When client credentials NOT saved yet:

- Client ID input field
- Client Secret input field (masked)
- Setup instructions text (with `{origin}` replaced by actual origin for the callback URL)
- Docs link ("Create your OAuth app")
- "Save Credentials" button
- For Google: "Or import from gws CLI" link

### When client credentials saved but NOT connected:

- "Connect with {provider}" button (primary action)
- For Google: "Or import from gws CLI" button
- "Edit credentials" link (to change client ID/secret)

### When connected:

- Green dot + "Connected"
- "Disconnect" button

### OAuth success/error handling:

When the user is redirected back to settings after OAuth:
- Parse `?oauth=success&provider=X` or `?oauth=error&provider=X&error=Y` from the URL
- Show a transient success/error toast
- Clean up the URL params

## Credential Resolver Changes

Update `resolveGitHubConfig()` and `resolveGSCConfig()` in `credential-resolver.ts`:

```typescript
export async function resolveGitHubConfig(): Promise<GitHubConfig | null> {
  // Try stored OAuth token first
  const creds = await resolveCredential("shipping/github");
  if (creds?.token) {
    return { token: creds.token };
  }
  // Fall back to env var (PAT)
  return createGitHubConfigFromEnv();
}

export async function resolveGSCConfig(): Promise<GSCConfig | null> {
  // Try stored OAuth credentials first
  const creds = await resolveCredential("seo/google-search-console");
  if (creds?.refreshToken && creds?.clientId && creds?.clientSecret) {
    return {
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      refreshToken: creds.refreshToken,
    };
  }
  // Fall back to env vars
  const { createConfigFromEnv } = await import("@radarboard/api/google-search-console");
  return createConfigFromEnv();
}
```

## File Changes Summary

| File | Change |
|------|--------|
| `packages/widgets/src/widgets/types.ts` | Add `oauth?: { provider, scopes, setupInstructions }` to `WidgetAuth` |
| `apps/app/lib/oauth-providers.ts` | New: OAuth provider registry (GitHub + Google configs) |
| `apps/app/app/api/auth/[provider]/redirect/route.ts` | New: OAuth redirect route |
| `apps/app/app/api/auth/[provider]/callback/route.ts` | New: OAuth callback route |
| `apps/app/app/api/auth/gws-import/route.ts` | New: Import tokens from gws CLI (Google only) |
| `apps/app/components/settings-widgets.tsx` | Replace "Coming soon" with OAuth card (client creds + connect button). Fix `countServices` to include `oauth` type in total/connected counts. Handle `type === "oauth"` descriptors missing `oauth` config gracefully (show "Configure provider" prompt). |
| `apps/app/lib/credential-resolver.ts` | Update GitHub and GSC resolvers to read from credential store |
| `packages/widgets/src/widgets/shipping/index.tsx` | Update GitHub auth descriptor with `oauth` config and `fields` |
| `packages/widgets/src/widgets/seo/index.tsx` | Update Google auth descriptor with `oauth` config and `fields` |
| `packages/widgets/src/widgets/github-stars/index.tsx` | Update GitHub auth descriptor with `oauth` config and `fields` |

## Security Considerations

- **CSRF**: Random `state` parameter in httpOnly cookie, verified on callback
- **Redirect validation**: Callback URL dynamically constructed from request origin (not from query params)
- **Cookie security**: `httpOnly`, `secure` (in production), `sameSite: lax`, `maxAge: 300`
- **Client secrets**: Encrypted at rest in credential store (AES-256-GCM, same as Phase A)
- **Token storage**: OAuth tokens encrypted alongside other credentials
- **No token in URL**: Tokens never appear in URLs or browser history

## Testing Considerations

- Unit: OAuth redirect route constructs correct authorization URL
- Unit: OAuth callback route verifies state and exchanges code
- Unit: CSRF rejection when state doesn't match
- Unit: Token storage in credential store after successful callback
- Integration: Full OAuth redirect → authorize → callback → token stored flow
- Integration: Credential resolver reads stored OAuth token
- Integration: Settings UI shows correct state (no creds → creds saved → connected)
