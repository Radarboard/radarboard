# RSS Reader Workspace — Implementation Plan

**Date:** 2026-03-20
**Spec:** [2026-03-20-rss-reader-workspace-design.md](/Users/thedaviddias/Projects/radarboard/docs/superpowers/specs/2026-03-20-rss-reader-workspace-design.md)
**Status:** Ready for implementation

---

## Objective

Turn the RSS plugin from a narrow side-panel feed list into a fullscreen reader workspace with:

- a 3-pane reading layout
- explicit separation between integration-backed feeds and manual feeds
- feed-level categories plus article-level `Saved`, `Read Later`, and `Boards`
- article extraction with feed-content fallback
- Radarboard notifications and ticker support

---

## Current Groundwork

There is already in-flight groundwork in the worktree that the implementation should reuse rather
than replace:

- RSS feed URL discovery for normal page URLs and direct feed URLs
- integration-level RSS override storage in `Settings > Integrations`
- server route support for resolving a URL to a feed XML URL

Before the workspace refactor, that groundwork should be stabilized and treated as the source of
truth for integration-backed feed URLs.

---

## Delivery Sequence

### Phase 1 — Stabilize RSS source foundations

Primary files:

- `packages/plugins/src/plugins/rss-reader/discovery.ts`
- `packages/plugins/src/plugins/rss-reader/mcp-tools.ts`
- `packages/plugins/src/plugins/rss-reader/use-rss-reader.ts`
- `apps/app/app/api/plugins/rss-reader/discover/route.ts`
- `apps/app/lib/integration-rss-feeds.ts`
- `apps/app/components/settings/settings-integrations/index.tsx`

Work:

1. Keep the current feed-discovery path as the canonical URL normalization layer.
2. Treat integration RSS overrides as the canonical source for integration-backed feeds.
3. Decide and document how the RSS plugin reads the integration RSS override map on load.
4. Ensure the current discovery and integration-RSS helper code is covered by focused tests and can
   be reused by later phases without reshaping the API again.

Exit criteria:

- normal URLs resolve to feed XML URLs through one shared code path
- integration RSS URLs are globally readable by the RSS plugin
- no duplicate discovery logic exists in client and server code

### Phase 2 — Expand the RSS data model and storage layout

Primary files:

- `packages/plugins/src/plugins/rss-reader/types.ts`
- `packages/plugins/src/plugins/rss-reader/use-rss-reader.ts`
- `packages/plugins/src/plugins/rss-reader/mcp-tools.ts`
- new tests under `packages/plugins/src/plugins/rss-reader/*.test.ts`

Work:

1. Replace the simple `RssFeed` model with a richer source model:
   - `origin`
   - `originRef`
   - `categoryIds`
   - `isEditable`
   - `isEnabled`
2. Expand article state to support:
   - `saved`
   - `readLater`
   - extracted content fields
3. Add plugin-owned storage buckets for:
   - manual feeds
   - integration feeds
   - categories
   - boards
   - article-board joins
   - UI state
4. Update MCP tool behavior to respect manual vs integration-backed sources.

Exit criteria:

- storage shape supports the full reader workflow before any large UI rewrite
- integration sources are read-only by type, not by ad hoc UI logic
- tests cover category, board, and source-origin behavior

### Phase 3 — Fullscreen plugin shell and 3-pane workspace

Primary files:

- `packages/plugins/src/plugins/rss-reader/index.ts`
- `packages/plugins/src/plugins/rss-reader/components/rss-reader-overlay.tsx`
- new RSS subcomponents under `packages/plugins/src/plugins/rss-reader/components/`

Work:

1. Change the plugin presentation from `side-panel` to `fullscreen`.
2. Replace the current single-column overlay with a 3-pane shell:
   - left navigation
   - center article list
   - right reader pane
3. Build dedicated components for:
   - source/sidebar navigation
   - article list
   - reader pane
   - feed/category/board management surfaces
4. Ensure scrollable panes use `scrollbar-thin` and avoid horizontal overflow.

Exit criteria:

- the plugin no longer feels like a drawer
- the layout supports persistent navigation, list browsing, and in-app reading simultaneously

### Phase 4 — Source organization: Integrations, My Feeds, Categories, Boards

Primary files:

- `packages/plugins/src/plugins/rss-reader/use-rss-reader.ts`
- RSS reader components created in Phase 3

Work:

1. Populate the left navigation with:
   - `All Unread`
   - `Read Later`
   - `Saved`
   - `Boards`
   - `Integrations`
   - `My Feeds`
   - `Categories`
2. Keep integration feeds read-only in the plugin UI.
3. Keep manual feeds editable and removable.
4. Add category assignment flows at the feed level.
5. Add board assignment flows at the article level.

Exit criteria:

- source separation is explicit and enforced
- categories organize feeds only
- boards organize articles only

### Phase 5 — Reader actions and article extraction

Primary files:

- `packages/plugins/src/plugins/rss-reader/use-rss-reader.ts`
- new extraction helper(s) under the RSS plugin or a web route if server-side extraction is needed
- RSS reader pane component(s)

Work:

1. Add article actions:
   - `Save`
   - `Read Later`
   - `Open original`
   - `Mark read`
   - `Mark unread`
   - `Add to board`
2. Add article extraction flow:
   - attempt extraction from original article URL
   - cache extracted content
   - fall back to feed content or summary
3. Keep the reader usable even when extraction fails or is unavailable.

Exit criteria:

- reading an article in-app is a first-class path
- extraction failure never blocks the core read/open workflow

### Phase 6 — Notifications, ticker, and widget compatibility

Primary files:

- `packages/plugins/src/plugins/rss-reader/index.ts`
- `packages/plugins/src/plugins/rss-reader/use-rss-reader.ts`
- `packages/plugins/src/plugins/rss-reader/widget.tsx`
- any helper files needed for event emission and ticker shaping

Work:

1. Opt the RSS plugin into `radarboardIntegrations.notifications` and
   `radarboardIntegrations.ticker`.
2. Emit notification events for new unread items from eligible feeds.
3. Surface ticker items from recent unread headlines.
4. Keep the compact widget compatible with the new unread/source model.

Exit criteria:

- RSS appears in shared plugin notifications/ticker controls
- new RSS items can contribute to shared Radarboard surfaces
- widget state still reflects unread counts and recent items correctly

### Phase 7 — Verification and cleanup

Primary files:

- targeted test files across `packages/plugins` and `apps/app`

Work:

1. Add focused tests for:
   - integration feed sync
   - manual feed CRUD
   - category/board persistence
   - extraction fallback
   - notification/ticker emission
2. Run focused checks first:
   - `pnpm --filter @radarboard/plugins test`
   - `pnpm --filter @radarboard/plugins typecheck`
   - `pnpm --filter @radarboard/app test` for RSS-related routes/helpers
   - `pnpm --filter @radarboard/app typecheck`
3. Run manual verification for:
   - fullscreen workspace layout
   - sidebar grouping
   - read-only integration feeds
   - reader fallback behavior
   - save/read-later/board flows
   - ticker/notification toggles

Exit criteria:

- data model, fullscreen layout, and Radarboard surface behavior are all verified
- no legacy drawer assumptions remain in the RSS plugin

---

## Suggested Commit Slices

1. `rss-foundation`: stabilize discovery + integration RSS override helpers
2. `rss-model`: expand storage/types for sources, categories, boards, article state
3. `rss-shell`: fullscreen 3-pane workspace and navigation
4. `rss-reader`: extraction + article actions
5. `rss-radarboard`: notifications, ticker, and widget compatibility

This keeps the highest-risk UI rewrite separate from the foundational storage changes.

---

## Known Risks

- the current RSS plugin has almost no real ingestion model beyond stored feeds/items, so the
  workspace refactor and data model expansion are tightly coupled
- integration feed sync can become fragile if service ids, integration overrides, and plugin source
  ids drift
- article extraction can introduce latency and failure cases that must not degrade the reader
- the current `settings-integrations.tsx` file remains difficult to mount in Vitest, so helper and
  route tests may still be more reliable than full component tests until that file is refactored

---

## Known Blocker

The repository is currently dirty with unrelated changes outside the RSS scope. Implementation
should avoid reverting or assuming ownership of those files. Each feature commit should stage only
the RSS-related files and work with the existing pre-commit hook behavior.
