# RSS Reader Workspace Design

**Date:** 2026-03-20
**Status:** Approved

## Overview

The current RSS plugin behaves like a narrow drawer: it can add feeds and show recent items, but it
does not support a real reading workflow. The approved direction is to turn it into a fullscreen
reader workspace closer to a dedicated RSS app, with explicit separation between integration-backed
feeds and manual feeds, a proper article reading surface, and first-class organization controls.

The approved direction is:

- move the RSS plugin from `side-panel` to `fullscreen`
- replace the single-column list with a 3-pane reader workspace
- separate `Integrations` feeds from `My Feeds`
- support feed-level categories/folders plus article-level `Saved`, `Read Later`, and `Boards`
- read articles in-app using extracted article content when possible, with fallback to feed content
  and `Open original`
- add reader actions such as `Save`, `Read Later`, `Open original`, and `Mark read/unread`
- wire the RSS plugin into Radarboard notifications and ticker like other first-class plugins

## Goals

- Make the RSS plugin feel like a real reading product instead of a feed drawer.
- Provide clear source separation between integration-managed feeds and manually added feeds.
- Support both feed-level organization and article-level organization.
- Preserve the ability to add normal website URLs and resolve them to feed XML URLs.
- Surface article content in-app when extraction succeeds.
- Let RSS contribute to shared Radarboard surfaces such as notifications and ticker.

## Non-Goals

- Full Feedly feature parity.
- Social/comment collaboration features inside boards.
- Full offline reading or sync across devices.
- Browser-extension style capture into the RSS plugin.
- Rebuilding the compact dashboard widget in the same pass unless needed for compatibility.

## Decisions

- **Presentation:** The RSS plugin becomes a fullscreen workspace, following the tasks plugin model
  more closely than the current drawer.
- **Layout:** Use a 3-pane shell:
  - left: source navigation
  - center: article list
  - right: reading pane
- **Source separation:** Integration-backed feeds are read-only inside the RSS plugin and live
  under `Integrations`. Manual feeds live under `My Feeds` and remain editable.
- **Feed organization:** Categories act like feed-level folders and can contain both integration
  feeds and manual feeds.
- **Article organization:** `Saved`, `Read Later`, and `Boards` are article-level constructs and
  are separate from feed categories.
- **Reading content:** Attempt article extraction first. If extraction fails, fall back to
  feed-provided content/summary and always offer `Open original`.
- **Persistence:** RSS feed overrides coming from the integrations modal save the resolved XML URL,
  not the original page URL.
- **Radarboard integration:** RSS opts into both notifications and ticker with plugin-level enable
  toggles handled by the existing plugin settings system.

## Information Architecture

### Left Pane

The left pane becomes the stable navigation spine for the plugin. It should support:

- `All Unread`
- `Read Later`
- `Saved`
- `Boards`
- `Integrations`
- `My Feeds`
- `Categories`

This mirrors the core mental model from Feedly that is worth borrowing:

- sidebar-centric navigation
- explicit separation of team/shared sources and personal sources
- `Read Later`
- boards as article collections

### Center Pane

The center pane lists articles for the current selection. It should support:

- source/category/board scoped lists
- unread filtering
- newest-first sorting
- row affordances for `Save`, `Read Later`, `Open original`, `Mark read/unread`
- selection state that drives the reader pane

### Right Pane

The right pane is the reading surface. It should show:

- article title and metadata
- source/feed identity
- extracted content when available
- fallback feed content when extraction is unavailable
- action cluster:
  - `Save`
  - `Read Later`
  - `Open original`
  - `Mark unread`
  - `Add to board`

## Data Model

### Feed Source

Expand the feed model from a simple manual list into a typed source model.

Suggested fields:

```ts
interface RssFeedSource {
  id: string;
  name: string;
  feedUrl: string;
  origin: "integration" | "manual";
  originRef?: string | null;
  categoryIds: string[];
  isEditable: boolean;
  isEnabled: boolean;
  addedAt: string;
}
```

Rules:

- integration feeds:
  - created from integration RSS overrides
  - read-only in the RSS plugin
  - removable only by changing integration settings or disabling sync
- manual feeds:
  - created in the RSS plugin
  - fully editable/removable

### Article

Suggested fields:

```ts
interface RssArticle {
  id: string;
  feedSourceId: string;
  title: string;
  link: string;
  publishedAt: string;
  summaryHtml?: string | null;
  contentHtml?: string | null;
  contentText?: string | null;
  extractedContentHtml?: string | null;
  read: boolean;
  saved: boolean;
  readLater: boolean;
}
```

### Categories and Boards

Feed-level categories:

```ts
interface RssFeedCategory {
  id: string;
  name: string;
  feedIds: string[];
}
```

Article-level boards:

```ts
interface RssBoard {
  id: string;
  name: string;
  description?: string;
}

interface RssArticleBoard {
  articleId: string;
  boardId: string;
}
```

Boundary:

- categories organize feeds
- boards organize articles
- articles do not belong directly to categories

## Integration Feed Sync

The integrations settings page now supports storing RSS feed URLs per service. The RSS plugin
should consume those values and surface them in the `Integrations` section.

Behavior:

- on load, read the global integration RSS override map
- create/update read-only integration feed sources from those URLs
- keep manual feeds in separate plugin-owned storage
- do not allow manual edits to integration-managed feed URLs from inside the RSS plugin
- if an integration RSS URL is disabled/removed, remove or archive the corresponding integration
  feed source deterministically

Recommended storage split:

- `rss:manual-feeds`
- `rss:integration-feeds`
- `rss:categories`
- `rss:boards`
- `rss:articles`
- `rss:article-boards`
- `rss:ui-state`

## Article Extraction

The reader must show more than RSS summaries when possible.

Flow:

1. User selects an article.
2. Try to fetch/extract the article body from the original article URL.
3. If extraction succeeds, show extracted content in the reading pane.
4. If extraction fails, fall back to feed-provided `content` or `summary`.
5. Always keep `Open original` available.

Constraints:

- extraction failures must not block reading
- extraction should be cacheable per article URL
- the reader should clearly prefer extracted content without hiding that the canonical source is the
  original page

## Notifications and Ticker

The RSS plugin should opt into Radarboard shared surfaces like status-page does.

### Notifications

Initial notification scope:

- emit notifications for new unread items from feeds selected for notifications
- default to integration-backed feeds first, since they are more likely to be signal-bearing

Future scope can add:

- notifications for saved/read-later actions
- per-feed importance rules

### Ticker

Initial ticker scope:

- recent unread headlines from eligible feeds
- short metadata: feed name + publish time

Controls remain at the plugin settings level via the existing shared plugin integrations UI.

## UI States and Actions

### Manual Feed Management

Manual feed actions:

- add feed by normal page URL or direct feed URL
- edit feed
- remove feed
- assign to categories

### Integration Feed Management

Integration feed actions:

- view feed
- enable/disable locally if needed
- open integration settings

But not:

- edit feed URL
- rename source independently from the integration identity

### Article Actions

Each article should support:

- `Save`
- `Read Later`
- `Open original`
- `Mark read`
- `Mark unread`
- `Add to board`

Bulk actions are desirable but can land after the initial reader workspace.

## Files Expected To Change

| File | Change |
|---|---|
| `packages/plugins/src/plugins/rss-reader/index.ts` | Change presentation to `fullscreen`, enable Radarboard integrations |
| `packages/plugins/src/plugins/rss-reader/types.ts` | Expand feed and article models; add categories/boards/storage shapes |
| `packages/plugins/src/plugins/rss-reader/use-rss-reader.ts` | Rework storage, sync integration feeds, selection state, reader actions |
| `packages/plugins/src/plugins/rss-reader/components/rss-reader-overlay.tsx` | Replace current drawer list with 3-pane workspace |
| `packages/plugins/src/plugins/rss-reader/widget.tsx` | Keep widget compatible with new unread/source model |
| `packages/plugins/src/plugins/rss-reader/mcp-tools.ts` | Update feed management tools to respect manual vs integration sources |
| `apps/app/lib/integration-rss-feeds.ts` | Source of truth for integration-provided feed URLs consumed by the plugin |
| `apps/app/app/api/plugins/rss-reader/discover/route.ts` | Continue supporting feed URL discovery |
| `apps/app/app/api/notifications/emit/route.ts` | Existing event path used by plugin notifications |
| `packages/plugins/src/types.ts` | Reuse shared Radarboard integration support |

## Validation

- Verify the RSS plugin launches as a fullscreen workspace.
- Verify the left pane separates `Integrations` and `My Feeds`.
- Verify integration-provided feeds are read-only in the plugin.
- Verify manual feeds remain editable.
- Verify categories organize feeds, not articles.
- Verify `Saved`, `Read Later`, and `Boards` organize articles.
- Verify the reading pane shows extracted content with fallback to feed content.
- Verify `Open original` is always available.
- Verify RSS notifications can be enabled/disabled through plugin settings.
- Verify RSS ticker participation can be enabled/disabled through plugin settings.
- Verify no new horizontal overflow is introduced and all scrollable surfaces use
  `scrollbar-thin`.
