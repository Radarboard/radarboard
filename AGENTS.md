# Radarboard

## Project Architecture
- Project name is "Radarboard".
- Monorepo using pnpm and Turborepo.
- The canonical project-specific extension-creation skills live in `skills/`, specifically `create-integration`, `create-plugin`, and `create-widget`. Keep those mirrored into `.agents/skills` and `.claude/skills` via per-skill symlinks instead of maintaining duplicate copies.
- Marketing site is located in `apps/marketing`, built with Next.js, Tailwind CSS v4, and React.
- Keep rename-sensitive marketing copy in centralized data (for example `apps/marketing/data/site.ts`) instead of hardcoding the product name across pages and components.
- Local development uses `portless` for named local dev server URLs.
- Dashboard (web app): `http://radarboard.localhost:1355`
- Marketing site: `http://radarboard-marketing.localhost:1355`
- Desktop app (`apps/desktop`, Tauri): `tauri dev` loads `build.devUrl`; keep it aligned with how the web app is reached in dev (portless HTTPS on 1355 when `PORTLESS_HTTPS=1` is used for `@radarboard/app`).

## Design & UI Standards
- **Zero Tolerance for Arbitrary Values**: NEVER use hardcoded Tailwind arbitrary values (e.g., `text-[11px]`, `bg-[#111]`, `rounded-[2px]`).
- **Standardized Tokens Only**: Use semantic tokens from `globals.css` (e.g., `text-w-sm`, `bg-surface`, `border-border`).
- **Typography**: Follow the 6-step scale (`text-w-xs` to `text-w-2xl`).
- **Theming**: Support both Light and Dark mode using semantic colors. Never use hex codes in components.
- **Radius & Borders**: Most UI is strictly square (`rounded-none`, `rounded-item`).
- **Standardized Icons**: Use semantic classes (`icon-xs`, `icon-sm`, `icon-base`, `icon-lg`).
- **Standardized Transitions**: Use `transition-interactive` for all hover/active states.
- **Scrollbars**: All scrollable containers must use `scrollbar-thin`. Never leave a scrollable element with the default browser scrollbar.
- **Overflow**: Never allow horizontal scrolling in UI components. Use `overflow-x-hidden`, `truncate`, or `min-w-0` to prevent horizontal overflow.
- **Lists**: Tailwind v4 preflight removes default list markers on `ul`/`ol`. For markdown or rich lists, restore markers with scoped CSS that beats preflight; use `list-inside` or inner padding when a parent uses `overflow-x-hidden`/`min-w-0`, because outside markers sit in the margin and get clipped. Account for GFM loose lists (`li > p`) so paragraph margins do not hide or break markers. If native markers still fail after CSS fixes, render bullets or numbers explicitly in the component instead of relying on `list-style`.
- **Marketing & public pages**: Prefer intentional structure and distinctive craft over generic landing-template layouts; badges, hierarchy, and section rhythm should communicate real product story, not decoration alone.

## Settings Pages
- All settings pages must use `SettingsPageLayout`, `SettingsGrid`, and `EmptyState` from `@radarboard/ui`.
- Every settings page must include a search bar (enabled by default in `SettingsPageLayout`).
- Use 3-column grid layout via `SettingsGrid` for card-based content.
- Follow the standard pattern: header (title + description + status counter) → search → grid of cards.
- Reference `settings-integrations.tsx` and `settings-plugins.tsx` as canonical examples.

## Workflow Preferences
- Do not automatically start dev servers (e.g., `pnpm dev`), as they are kept running continuously by the user.
- When writing Astro components, properly escape JSX expressions in code snippets (e.g., `import {'{'} Widget {'}'}`) to prevent undefined variable errors during build.
- Biome must parse Tailwind-only at-rules in shared CSS: `css.parser.tailwindDirectives` is enabled in `biome.json` so files like `apps/app/app/globals.css` (`@theme`, `@source`, etc.) lint without false “Tailwind-specific syntax is disabled” errors.
- For UI or UX reviews against internal standards, use the repo `ux-patterns` skill (load and follow it) instead of improvising.
- Storybook stories must compose only from real app components, real pages, and real product states that exist in the codebase. Never invent fake chrome, fake copy, fake placeholders, or opinionated UI that does not appear in Radarboard.
- If a state or surface is missing, add it to the actual page/component first and then compose the story from that real implementation. Do not simulate missing product behavior by drawing stand-in boxes or adding explanatory text that is not part of the app.
- Prefer screen stories that wrap actual app surfaces such as `Dashboard`, `DashboardSkeleton`, settings pages, dialogs, and debug sections, with mocks/controls only for switching between real states.
- Never add Storybook-only wrapper layout around a component to simulate product behavior. If centering, spacing, empty-state layout, or positioning is needed, add a real component mode or shared provider/decorator that reflects the actual product implementation.
- Plugin overlays: keep URL query params and selection in sync—apply plugin item params on initial page load (not only after internal navigation events), and update the query string when the user selects an item where the product expects shareable deep links.
- Shared plugin behavior (e.g. delayed mark-read) should live in reusable hooks or SDK utilities so multiple plugins stay consistent.
- For multi-session, multi-hour, cross-package, migration, or high-risk work, create and maintain an ExecPlan according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).
- Store ExecPlans in `docs/superpowers/specs` using the `YYYY-MM-DD-<topic>-plan.md` naming pattern.

## Learned User Preferences
- Do not use the old product name “Situation Monitor”, “formerly …” rename disclaimers, or the `situation-monitor` slug; keep branding and examples as Radarboard only.
- Radarboard is not a developer-only product. Prefer job-first messaging, and when concrete audiences help, use groups like indie hackers, open-source maintainers, creators, and teams instead of “developer dashboard” or “software teams only”.

## Learned Workspace Facts
- Public docs live in `apps/docs` (Mintlify). The package `build` runs `mint validate`; Mintlify CLI v4 has no `mint build`. Canonical docs URL is `https://docs.radarboard.app`.
- Tauri desktop `identifier` is `com.radarboard.client`; avoid bundle identifiers ending in `.app` on macOS (reserved bundle extension).
