# Integrations Configuration Guide

This guide covers how to configure each external service that powers the Radarboard dashboard. Every integration is optional -- the dashboard gracefully falls back to mock data when an integration is not configured.

## Quick Start

1. Copy the env template: `cp apps/app/.env.example apps/app/.env`
2. Fill in the env vars for the services you want to connect (see sections below)
3. Add per-project config in `apps/app/config/projects.ts` (non-secret IDs, slugs, URLs)
4. Run `pnpm dev` -- the dashboard will use real data for configured services, mock data for everything else

## How It Works

Each integration follows the same architecture:

```
.env (secrets)  +  projects.ts (IDs/slugs)  -->  API Client  -->  API Route  -->  React Hook  -->  Widget
```

- **Secrets** (API keys, tokens) go in `apps/app/.env`
- **Non-secret identifiers** (project IDs, site URLs, repo names) go in `apps/app/config/projects.ts` under each platform's `integrations` field
- The dashboard checks if env vars are present at runtime. If they're missing, the API route returns `{ configured: false }` and the widget shows mock data.

---

## RevenueCat

**Powers:** Revenue KPI cards, revenue chart, MRR/gross/net metrics

### 1. Get Credentials

1. Go to [app.revenuecat.com](https://app.revenuecat.com)
2. Select your project
3. Go to **API Keys** in the left sidebar
4. Copy your **v2 Secret API Key** (starts with `sk_`)
5. Copy your **Project ID** from the project URL or settings

### 2. Set Environment Variables

```env
REVENUECAT_API_V2_SECRET_KEY=sk_xxxxxxxxxxxx
REVENUECAT_PROJECT_ID=proj_xxxxxxxxxxxx
```

### 3. Update Project Config

In `apps/app/config/projects.ts`, add `revenuecat` to the platform that has subscriptions:

```ts
integrations: {
  revenuecat: {
    projectId: "proj_xxxxxxxxxxxx",
  },
}
```

### Notes

- Rate limit: 5 requests per minute (Charts & Metrics endpoints)
- Data is cached server-side for 5 minutes
- Supports USD, EUR, GBP, CAD, JPY, and other currencies via the dashboard currency toggle

---

## OpenPanel

**Powers:** Analytics widget (live visitors, sessions, page views, bounce rate, top pages, referrers)

### 1. Get Credentials

1. Go to your OpenPanel dashboard
2. Navigate to **Settings > Clients**
3. Create a **Root client** (this gives access to all projects under your account)
4. Copy the **Client ID** and **Client Secret**

### 2. Set Environment Variables

```env
OPENPANEL_CLIENT_ID=your-client-id
OPENPANEL_CLIENT_SECRET=your-client-secret
```

### 3. Update Project Config

Add `openPanel` with the project-specific ID for each platform you track:

```ts
integrations: {
  openPanel: {
    projectId: "your-openpanel-project-id",
  },
}
```

### Notes

- A single root client is used for all projects. Each platform specifies its own `projectId`.
- Live visitor count updates every 15 seconds; other metrics every 60 seconds.
- The `projectId` is shown in your OpenPanel dashboard URL or project settings.

---

## Open Collective

**Powers:** Open Collective KPIs (balance, total raised, yearly budget, backers), recent transactions, top members

### 1. Get Credentials

1. Go to [opencollective.com](https://opencollective.com)
2. Navigate to your account: `https://opencollective.com/{account}/admin/for-developers`
3. Create a **Personal Token** with the `account` scope
4. Copy the token

### 2. Set Environment Variables

```env
OPENCOLLECTIVE_API_TOKEN=your-personal-token
```

### 3. Update Project Config

Add `openCollective` to the relevant platform:

```ts
integrations: {
  openCollective: {
    slug: "front-end-checklist", // Your collective's slug on opencollective.com
  },
}
```

### Notes

- Uses the GraphQL API v2
- Data cached for 5 minutes
- The slug is the part after `opencollective.com/` in your collective's URL

---

## Linear

**Powers:** Ideas + Bugs widget (open issues categorized by labels), Shipping Log (completed issues)

### 1. Get Credentials

1. Go to [linear.app/settings/api](https://linear.app/settings/api)
2. Under **Personal API keys**, click **Create key**
3. Give it a label (e.g., "Radarboard") and copy the key

### 2. Set Environment Variables

```env
LINEAR_API_KEY=lin_api_xxxxxxxxxxxx
```

### 3. Update Project Config

Add `linear` to platforms where you track issues:

```ts
integrations: {
  linear: {
    teamId: "TEAM-UUID",       // Optional: filter to a specific team
    labelNames: ["bug", "idea"], // Optional: filter issues by label names
  },
}
```

### Finding Your Team ID

Run this in your browser console while on Linear, or use the Linear API:

```graphql
query { teams { nodes { id name key } } }
```

### How Issues Are Categorized

- Issues with labels containing "bug" or "defect" show as **bugs**
- All other issues show as **ideas**
- Priority is mapped from Linear's 0-4 scale: 1=critical, 2=high, 3=medium, 4=low

### Notes

- Both open issues (Ideas+Bugs widget) and completed issues (Shipping Log) are fetched
- Data cached for 2 minutes
- If no `teamId` is provided, issues from all teams are shown

---

## GitHub

**Powers:** Shipping Log (merged pull requests)

### 1. Get Credentials

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Select scopes:
   - `public_repo` -- for public repositories only
   - `repo` -- for private repositories (includes public)
4. Copy the token

### 2. Set Environment Variables

```env
GITHUB_TOKEN=<personal access token from GitHub (classic PAT)>
```

### 3. Update Project Config

Add `github` to platforms backed by a GitHub repository:

```ts
integrations: {
  github: {
    owner: "thedaviddias",
    repo: "goshuin-atlas",
  },
}
```

### Notes

- Only merged PRs appear in the Shipping Log (open and unmerged PRs are filtered out)
- Rate limit: 5,000 requests per hour (authenticated)
- Data cached for 2 minutes

---

## Resend

**Powers:** Email alerts for health check failures and custom notifications

### 1. Get Credentials

1. Go to [resend.com/api-keys](https://resend.com/api-keys)
2. Create a new API key
3. Set up a verified sending domain in Resend (required for the `from` email)

### 2. Set Environment Variables

```env
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=alerts@yourdomain.com
RESEND_TO_EMAIL=you@yourdomain.com
```

### 3. Usage

Resend is an outbound-only service. It doesn't have a dashboard widget. Alerts are sent via the API:

```
POST /api/alerts/send
Content-Type: application/json

{
  "type": "health",
  "name": "goshuin.com",
  "url": "https://goshuin.com",
  "status": "down"
}
```

Or for custom alerts:

```
POST /api/alerts/send
Content-Type: application/json

{
  "type": "custom",
  "subject": "Revenue milestone reached",
  "html": "<h1>Congratulations!</h1><p>MRR hit $5,000</p>"
}
```

### Notes

- No project config needed -- Resend is a global service
- Rate limit: 2 req/s (free tier), 100 req/s (pro)
- The `from` email must be on a domain you've verified in Resend

---

## Google Search Console

**Powers:** SEO Performance widget (top search queries, clicks, impressions, CTR, position)

### 1. Configure OAuth Broker

This integration uses Radarboard's hosted OAuth broker. Users connect their own Google account. The hosted broker stores the Google refresh token; local and desktop clients store only an opaque broker token.

#### a) Create OAuth2 credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select an existing one
3. Enable the **Search Console API**: APIs & Services > Library > search "Search Console API" > Enable
4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > OAuth client ID**
6. Select **Web application**
7. Add `https://app.radarboard.app/api/auth/google/callback` to Authorized redirect URIs
8. Copy the **Client ID** and **Client Secret**

### 2. Set Environment Variables

```env
OAUTH_GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
OAUTH_GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
RADARBOARD_OAUTH_BROKER_URL=https://app.radarboard.app
```

### 3. Update Project Config

Add `googleSearchConsole` to platforms with a website:

```ts
integrations: {
  googleSearchConsole: {
    siteUrl: "https://goshuin.com", // Must match the property in GSC
  },
}
```

### Notes

- The `siteUrl` must exactly match how the site appears in your Google Search Console properties (including `https://` or `sc-domain:`)
- GSC data has a 2-3 day delay -- the API returns data up to 3 days ago
- Data cached for 5 minutes
- Access tokens are automatically refreshed when they expire

---

## Vercel

**Powers:** Shipping Log (production deployments), KPI strip "Last Deploy" indicator

### 1. Get Credentials

1. Go to [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Click **Create Token**
3. Give it a name and select the appropriate scope
4. Copy the token

If you're on a team:
1. Go to your team settings: `vercel.com/teams/{team}/settings`
2. Find your **Team ID** in the URL or settings page

### 2. Set Environment Variables

```env
VERCEL_TOKEN=xxxxxxxxxxxx
VERCEL_TEAM_ID=team_xxxxxxxxxxxx  # Optional, only if using a team
```

### 3. Update Project Config

Add `vercel` to platforms deployed on Vercel:

```ts
integrations: {
  vercel: {
    projectId: "prj_xxxxxxxxxxxx", // Your Vercel project ID
  },
}
```

### Finding Your Project ID

Go to your project on Vercel > Settings > General. The Project ID is displayed near the top.

### Notes

- Only production deployments with `READY` status appear in the Shipping Log
- If a deployment has a linked GitHub commit, its commit message is used as the title
- Rate limit: 500 requests per minute
- Data cached for 2 minutes

---

## Sentry

**Powers:** KPI strip error count, Sentry Issues detail panel (unresolved errors with trend)

### 1. Get Credentials

1. Go to [sentry.io/settings/auth-tokens/](https://sentry.io/settings/auth-tokens/)
2. Click **Create New Token**
3. Select these scopes: `project:read`, `event:read`, `org:read`
4. Copy the token
5. Note your **Organization slug** from your Sentry URL: `sentry.io/organizations/{org-slug}/`

### 2. Set Environment Variables

```env
SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxx
SENTRY_ORG_SLUG=your-org-slug
```

### 3. Update Project Config

Add `sentry` to platforms you monitor with Sentry:

```ts
integrations: {
  sentry: {
    projectSlug: "goshuin-atlas", // The project slug in Sentry
  },
}
```

### Finding Your Project Slug

Go to Sentry > Settings > Projects. The slug is shown under each project name, or in the URL: `sentry.io/organizations/{org}/projects/{project-slug}/`

### Notes

- Shows unresolved issues sorted by frequency
- The 24-hour error trend sparkline helps spot regressions
- Issues link directly to their Sentry permalink
- Data cached for 2 minutes

---

## App Store Connect

**Powers:** KPI strip app rating, App Store Reviews detail panel (ratings, reviews, version info)

### 1. Get Credentials

This requires an App Store Connect API key, which uses JWT authentication.

1. Go to [appstoreconnect.apple.com/access/api](https://appstoreconnect.apple.com/access/api)
2. Click **Generate API Key** (requires Admin or Account Holder role)
3. Give it a name and select the **Developer** role (minimum required)
4. Download the **Private Key** (.p8 file) -- you can only download it once
5. Note the **Key ID** (shown in the table)
6. Note your **Issuer ID** (shown at the top of the API Keys page)

### 2. Set Environment Variables

```env
ASC_KEY_ID=XXXXXXXXXX
ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ASC_PRIVATE_KEY="<single-line .p8 contents: PEM header + body + footer, newlines as \n>"
```

The private key is the content of the `.p8` file with newlines replaced by `\n`. You can convert it with:

```bash
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' AuthKey_XXXXXXXXXX.p8
```

### 3. Update Project Config

Add `appStoreConnect` to iOS/macOS app platforms:

```ts
integrations: {
  appStoreConnect: {
    appId: "1234567890", // Your Apple App ID (numeric)
  },
}
```

### Finding Your App ID

Go to App Store Connect > My Apps > select your app. The Apple ID is shown in the App Information section, or in the URL.

### Notes

- JWT tokens are automatically generated and refreshed (20-minute lifetime)
- Customer reviews are sorted by most recent
- Rate limit: 200 requests per minute
- Data cached for 15 minutes (App Store data updates slowly)

---

## BetterStack (Uptime)

**Powers:** KPI strip health status, Health Monitors detail panel, Ticker bar health alerts

### 1. Get Credentials

1. Go to [betterstack.com](https://betterstack.com) and sign in
2. Navigate to **Uptime > Settings > API**
3. Copy your **API Token**

### 2. Set Environment Variables

```env
BETTERSTACK_API_TOKEN=xxxxxxxxxxxx
```

### 3. Setup Monitors

No project config is needed -- BetterStack monitors are fetched globally. All non-paused monitors appear on the dashboard.

If you want to associate monitors with specific projects, the URL field in BetterStack should match the `healthCheck.url` in your project config, but this is not required.

### Notes

- Response times shown are averages across all monitoring regions
- Active incidents (unresolved) are highlighted at the top of the Health Monitors panel
- Data cached for 1 minute (health status should be as current as possible)
- Paused monitors are hidden from the dashboard

---

## Project Config Reference

All per-project config goes in `apps/app/config/projects.ts`. Here's a complete example showing all available integrations:

```ts
{
  id: "my-project",
  name: "My Project",
  slug: "my-project",
  color: "#E63946",
  description: "Description of the project",
  platforms: [
    {
      id: "my-project-ios",
      name: "iOS App",
      type: "ios",
      integrations: {
        revenuecat: { projectId: "proj_xxx" },
        appStoreConnect: { appId: "1234567890" },
      },
    },
    {
      id: "my-project-web",
      name: "myproject.com",
      type: "website",
      integrations: {
        openPanel: { projectId: "my-project" },
        googleSearchConsole: { siteUrl: "https://myproject.com" },
        healthCheck: { url: "https://myproject.com" },
        github: { owner: "username", repo: "my-project" },
        linear: { teamId: "TEAM-UUID", labelNames: ["bug", "idea"] },
        vercel: { projectId: "prj_xxx" },
        sentry: { projectSlug: "my-project" },
        betterstack: { monitorNamePattern: "myproject" },
      },
    },
  ],
}
```

## Troubleshooting

**Widget shows mock data instead of real data:**
- Check that the env vars are set in `apps/app/.env` (not the root `.env`)
- Restart the dev server after changing env vars
- Check the browser console for API errors (the hook will log fetch failures)

**API route returns `{ configured: false }`:**
- The required env vars for that service are missing or empty
- For project-specific data, verify the project has the integration configured in `projects.ts`

**"Token refresh failed" (Google Search Console):**
- Your refresh token may have expired. Re-generate it using the OAuth Playground steps above.
- Make sure the Search Console API is enabled in your GCP project.

**"HTTP 401" errors:**
- API key/token is invalid or expired. Generate a new one from the service's dashboard.
- For Sentry, check that your token has the required scopes.

**"HTTP 429" (rate limited):**
- The API client has built-in caching to minimize requests. If you're hitting limits, the cache may have been cleared (server restart). Wait a few minutes and it will recover.
