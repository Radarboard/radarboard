# Radarboard Web App — Strategic Review

_March 2026_

## Executive Summary

Radarboard is positioned to become **the command center for indie developers and small teams** — a category that doesn't exist yet. There are analytics tools, error trackers, and deployment dashboards, but nobody has unified them with a composable widget system, an AI copilot that reasons across all the data, and a local-first architecture that respects privacy.

---

## What's Working

### Architecture
- **20+ integrations** (GitHub, Sentry, Vercel, RevenueCat, Linear, App Store Connect, etc.) with a clean, composable integration layer.
- **Widget system** with templates, recipes, layout utilities, and per-widget MCP tool exposure — every widget is both visual and AI-queryable.
- **Local-first database** (SQLite + Drizzle ORM) with optional Turso cloud sync — privacy-respecting by default.
- **AI assistant** deeply woven into the data layer via MCP, not bolted on as a chatbot.
- **Desktop app** via Tauri v2 for native experience.
- **Clean monorepo** with 17 shared packages, consistent patterns, and 103 test files.

### Tech Stack
- Next.js 16, React 19, TypeScript 5.9, Tailwind CSS v4, Vercel AI SDK v6.
- Modern, future-proof choices across the board.

---

## Six Big Opportunities

### 1. Proactive AI Intelligence (Highest Impact)

The AI assistant can already query every data source. The next leap is making it **proactive** — surfacing insights before the user asks.

- "Conversion rate dropped 12% in Germany after yesterday's deploy."
- "Three PRs have been open for 2+ weeks — here's a triage summary."
- "Your Sentry error rate spiked 3x in the last hour. Here's what changed."
- Daily/weekly AI-generated briefings: "Here's what happened in your business today."

**Why this matters:** This is what makes someone never close the tab. Reactive dashboards require the user to know what to look for. Proactive intelligence finds what they missed.

### 2. Widget Marketplace / Community Widgets

The widget system is already templated and scaffolded (`create-widget` skill, `_template` directory). One step away from:

- `npx radarboard add widget:stripe-mrr` — CLI-installable widgets.
- A widget gallery in the settings UI — browse, preview, install.
- Community-contributed widgets with a simple descriptor + data hook + optional MCP tools pattern.
- Widget "recipes" that combine multiple data sources into composite views.

**Why this matters:** Platforms beat products. Let the community extend what Radarboard can monitor.

### 3. Multi-User / Team Mode

The architecture already hints at multi-tenancy: project-scoped integrations, credential encryption, OAuth flows. Adding:

- Shared dashboards with role-based access.
- Team views: "Show me what my team shipped this week."
- Commenting / annotations on metrics.
- Shared alert rules.

**Why this matters:** This is the SaaS unlock. Small teams (studios, agencies, 5-person SaaS companies) need exactly this kind of cross-platform visibility but can't afford enterprise monitoring suites.

### 4. Real-Time Alerting Engine

The pieces exist (SSE streams, webhook relay, notification package) but aren't unified into a first-class alerting system:

- Threshold-based rules: "Alert me if error rate > 5% for 10 minutes."
- Composite alerts: "Notify if revenue drops AND deploy happened in last 2 hours."
- Multi-channel delivery: Slack, email, push notification, in-app.
- Alert history and acknowledgment workflow.

**Why this matters:** Monitoring without alerting is a passive activity. Alerting makes the dashboard indispensable even when you're not looking at it.

### 5. Local-First as a Feature

SQLite locally + Turso sync + Tauri desktop is a compelling architecture. Own it:

- Full offline mode — works without internet, syncs when connected.
- Encrypted local backups with one-click restore.
- Zero-config setup: download the desktop app, connect your accounts, done.
- Data portability: export everything, import into a new instance.
- Privacy-first messaging in marketing: "Your data stays on your machine."

**Why this matters:** In a post-cloud-trust era, local-first is a genuine differentiator. Developers care about owning their data.

### 6. Marketing Positioning

The Astro marketing site should sell the vision, not the feature list:

- Hero: one screenshot showing everything working together — revenue, deploys, errors, SEO, AI assistant — all on one screen.
- Tagline: "Your entire indie business in one screen."
- Social proof: show real dashboards (anonymized) that demonstrate density of information.
- Comparison: not vs. Datadog or Grafana, but vs. "having 15 browser tabs open."

---

## Architectural Recommendations

### Strengthen
- **API layer**: 76+ routes in `apps/app/app/api/` could benefit from tRPC or a structured API layer as complexity grows.
- **CI/CD**: Only the webhook relay has a GitHub Actions workflow. Add build/test/lint pipelines for web, desktop, and packages.
- **`lib/` directory**: At 550KB+, consider migrating heavier utilities into dedicated packages to maintain clean boundaries.

### Preserve
- **Package boundaries**: The 17-package structure with clear responsibilities is excellent.
- **Widget descriptor pattern**: Consistent shape (data hook + MCP tools + template) makes the system learnable and extensible.
- **Settings page conventions**: `SettingsPageLayout` / `SettingsGrid` pattern keeps the UX consistent.
- **Test coverage**: 103 test files across the monorepo is solid for this stage.

---

## The Core Bet

The question isn't "what should we build next" — it's **"what's the one thing that makes someone never close this tab?"**

The answer: **the AI proactively telling you things you didn't know to ask about your own business.**

Every other monitoring tool shows you data. Radarboard should show you *meaning*.
