# Webhook Relay Integrations Design

**Date:** 2026-03-20
**Status:** Approved

## Overview

Rework the webhook relay UX inside **Settings > Integrations** so the integrations page stays
focused on discovery and connection state, while webhook-capable services surface their exact
endpoint inside their own configuration modal.

The approved direction is:

- remove the page-level `Webhook Relay` card from the integrations catalog
- add a shared `Webhook Relay` header action that opens a dedicated relay modal
- expand integration detail modals to a 2-column layout on wider viewports
- show per-service webhook endpoints only inside the relevant integration modal
- show each webhook-capable integration's signing secret in the same modal so the user can copy the
  value while creating the provider webhook
- keep relay deployment env configuration as a separate concern from dashboard-stored secrets

## Changes

### 1. Integrations Header Action (`apps/app/components/settings/settings-catalog-header/index.tsx`)

- Extend the catalog header so the integrations screen can render a secondary action button
- Use that action for `Webhook Relay`
- Keep the current title, description, status text, category tabs, and search flow intact
- Do not add a new settings menu or sub-view yet

### 2. Shared Relay Modal (`apps/app/components/settings/settings-integrations/index.tsx`)

- Replace the current page-level relay card with a dedicated dialog opened from the header action
- Keep this modal responsible only for the global relay base URL and short guidance
- Do not render a full endpoint list in this modal
- Include concise copy explaining that supported integrations derive their endpoint from this base
  URL
- Keep `RELAY_POLL_SECRET` and provider webhook signing secrets out of this modal because they are
  server-side deployment config, not user-facing runtime settings

### 3. Two-Column Integration Modals (`apps/app/components/settings/settings-integrations/index.tsx`)

- Widen integration detail dialogs and add a responsive 2-column layout on larger screens
- Collapse back to one column on narrower widths
- Left column: credential/auth setup first, then status page configuration when available
- Right column: webhook setup for supported integrations, then notification preferences
- Ensure all scrollable modal surfaces use `scrollbar-thin` and avoid horizontal overflow

### 4. Per-Integration Webhook Setup (`apps/app/components/settings/settings-integrations/index.tsx`)

- Add a dedicated `Webhook setup` card for integrations backed by the relay:
  - GitHub
  - Vercel
  - Sentry
  - Linear
  - BetterStack
- Derive the endpoint at render time from the shared relay URL plus `/api/webhooks/<integration>`
- If the relay URL is missing or invalid, show an empty state with a CTA to open the shared relay
  modal
- If the relay URL is configured, show the exact endpoint with copy affordance and lightweight
  service-specific setup guidance
- Add a signing secret field in the same card, stored in credentials under keys like
  `webhook_secret::github`
- Support reveal/hide, copy, manual save, and generation/regeneration for these secrets so the
  dashboard is the easiest place to retrieve the value needed during provider webhook creation
- Support `Generate` when no secret exists and `Regenerate` for rotation, using the same 24-byte
  hex secret format as notification webhook secrets
- Regeneration should create a draft value first and require explicit save, with a confirmation
  warning because rotating the secret invalidates the provider webhook until it is updated there too
- Non-webhook integrations should not render this card

### 5. State and Data Flow

- Continue storing the relay base URL in project integrations under the existing system key
- Do not add per-service endpoint storage
- Store local webhook signing secrets in the credentials repository using `webhook_secret::<id>`
- Do not add storage or editing for `RELAY_POLL_SECRET`
- Treat relay deployment env vars such as `WEBHOOK_SECRET_GITHUB` as a separate deployment step;
  the UI should explain that saving the dashboard copy does not automatically update the deployed
  relay

### 6. Validation

- Verify the integrations page no longer renders the old relay card
- Verify the header action opens the shared relay modal
- Verify webhook-capable integration modals show the derived endpoint when the relay URL exists
- Verify webhook-capable integration modals show a relay CTA when the relay URL is missing
- Verify non-webhook integrations do not render the webhook card
- Verify the dialog layout is responsive and does not introduce horizontal scrolling

## Files Expected To Change

| File | Change |
|---|---|
| `apps/app/components/settings/settings-catalog-header/index.tsx` | Add optional header action support |
| `apps/app/components/settings/settings-integrations/index.tsx` | Move relay UI into a dialog, widen service modals, add responsive 2-column layout, add webhook setup card |
| `apps/app/components/settings/settings-webhook-relay/index.tsx` | Convert or replace page card implementation to support dialog-based relay editing |
| `apps/app/components/settings/*.test.tsx` | Add or update focused coverage for relay modal and webhook-capable service modals |
