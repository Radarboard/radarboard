# Clickable Rows with Detail Modals

**Date:** 2026-03-16
**Status:** Approved

## Overview

Make every list row in every widget clickable. Clicking opens a centered modal overlay showing full details for that item, including fields that are currently available in the data but not rendered in the compact list view.

## Shared UI: DetailModal

Built on `@radix-ui/react-dialog` (consistent with existing Radix usage). Bloomberg-terminal dark styling:

- Overlay: `bg-black/60` with backdrop blur
- Content: `bg-[#111]`, `border-[#333]`, monospace fonts, max-width 500px, centered
- Header: title + X close button
- Body: scrollable content
- Footer: optional external links ("View on Open Collective", etc.)

## Per-Widget Detail Content

### OC Transaction Detail
Shows: type badge, full description, gross + net amount (netAmount), from/to accounts with avatars (fromAccount.imageUrl), exact datetime, external links to OC profiles (slug).

### OC Member Detail
Shows: avatar, name, org badge, role badge, tier, total donated, member since (since), link to OC profile (account.slug).

### Shipping Item Detail
Shows: title, source icon + label, project badge, exact created date (createdAt), external link (url).

### Ideas & Bugs Detail
Shows: title, type badge, status badge (status), priority badge (priority), project badge, age.

### Analytics Top Page Detail
Shows: path, page title (title), sessions, bounce rate (bounceRate), avg duration (avgDuration).

### SEO Query Detail
Shows: query text, clicks, impressions, position, CTR (ctr).

## Interaction Pattern

- `cursor-pointer` on rows, existing `hover:bg-[#1a1a1a]`
- `onClick` opens modal; `role="button"`, `tabIndex={0}`, Enter/Space keydown
- Each widget manages local state: `useState<T | null>(null)`
- External links open in new tab (`target="_blank"`, `rel="noopener noreferrer"`)

## Files

| File | Action |
|---|---|
| `packages/ui/package.json` | Add `@radix-ui/react-dialog` |
| `packages/ui/src/dialog/index.tsx` | Create |
| `packages/widgets/src/details/transaction-detail.tsx` | Create |
| `packages/widgets/src/details/member-detail.tsx` | Create |
| `packages/widgets/src/details/shipping-detail.tsx` | Create |
| `packages/widgets/src/details/idea-bug-detail.tsx` | Create |
| `packages/widgets/src/details/top-page-detail.tsx` | Create |
| `packages/widgets/src/details/seo-query-detail.tsx` | Create |
| `packages/widgets/src/open-collective.tsx` | Edit |
| `packages/widgets/src/shipping-log.tsx` | Edit |
| `packages/widgets/src/ideas-bugs.tsx` | Edit |
| `packages/widgets/src/analytics-live.tsx` | Edit |
| `packages/widgets/src/seo-queries.tsx` | Edit |
