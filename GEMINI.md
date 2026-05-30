# AI Mandates & Design System Rules

You are working on **Radarboard**, a dashboard system with a strict, coherent design language. To maintain this coherence, you MUST adhere to the following rules without exception.

## 1. Zero Tolerance for Arbitrary Values
NEVER use hardcoded Tailwind arbitrary values (e.g., `text-[11px]`, `bg-[#111]`, `rounded-[2px]`).
- **Standardized tokens ONLY.** If a token doesn't exist, check `globals.css` or ask for clarification.
- **Strictly forbidden patterns**: `text-[...px]`, `bg-[#...]`, `border-[#...]`, `rounded-[...px]`, `shadow-[...]`.

## 2. Typography (Simplified 6-Step Scale)
Use these semantic tokens. They scale automatically with the global `--w-scale`.
- `text-w-xs` (10px): Meta text, timestamps, tags, labels.
- `text-w-sm` (11px): **Default body text**, list items, normal text.
- `text-w-base` (13px): UI elements, buttons, sidebar items, descriptions.
- `text-w-lg` (16px): Headers, widget titles, section titles.
- `text-w-xl` (20px): Headline stats, large numbers.
- `text-w-2xl` (24px): Hero numbers, giant focus points.

## 3. Colors & Theming
Radarboard supports **Light and Dark mode** via `next-themes`.
- NEVER use hex codes in components.
- Use semantic variables: `bg-surface`, `bg-surface-raised`, `bg-secondary`, `text-foreground`, `text-foreground-secondary`, `text-dim`, `border-border`, `text-accent`, `text-destructive`, `text-success`, `text-warning`.
- **UI Components**: Always check `packages/ui` before styling manually.

## 4. Spacing & Layout
- **Icons**: Standardize with semantic classes: `icon-xs` (12px), `icon-sm` (14px), `icon-base` (16px), `icon-lg` (20px).
- **Transitions**: Use `transition-interactive` for all hover/active states.
- **Radius**: Most UI should be square. Use `rounded-none`, `rounded-item`, `rounded-card`, or `rounded-panel` (all currently 0px).
- **Widths**: Use layout tokens for containers: `w-sidebar` (280px), `w-[min(var(--spacing-panel),calc(100vw-2rem))]`.

## 5. Verification
After making any UI change:
1. Run `pnpm lint:fix` to ensure formatting.
2. Check the build.
3. Verify responsiveness in Light Mode.

## 6. Module Boundaries (Integrations, Plugins, Widgets)
Extensions must remain fully independent. Two enforcement layers run on every commit via lefthook:
- **Biome `noRestrictedImports`** in `biome.json` — catches wrong-SDK and forbidden shared-package imports.
- **`scripts/check-module-boundaries.ts`** — validates `package.json` deps and catches cross-extension imports.

### Allowed workspace dependencies

| Category | Allowed `@radarboard/*` deps |
|---|---|
| `integrations/*/` | `integration-sdk`, `types`, `utils` |
| `plugins/*/` | `plugin-sdk`, `types`, `utils`, `ui`, `widget-engine`, `embedding-service`, `llm` |
| `widgets/*/` | `widget-sdk`, `widget-engine`, `types`, `utils`, `ui`, `charts`, `hooks`, `assistant-ui` |

### What is forbidden
- Cross-extension imports (widget A importing widget B, plugin importing an integration, etc.)
- Using the wrong SDK (e.g., a widget importing `plugin-sdk`)
- Direct API calls from extensions — use `@radarboard/utils/api-routes` helpers instead

### Maintenance
When adding a **new shared package** to `packages/` that extensions should use:
1. Add it to the allowlist in `scripts/check-module-boundaries.ts` (`ALLOWED_WORKSPACE_DEPS`)
2. Remove it from the forbidden list in the relevant `biome.json` override block (search for `noRestrictedImports` under `integrations/*/src/**`, `plugins/*/src/**`, or `widgets/*/src/**`)

When adding a **new extension**, no config changes are needed — glob patterns cover all directories automatically.
