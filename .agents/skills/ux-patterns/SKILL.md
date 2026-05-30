---
name: ux-patterns
description: "Use when choosing, comparing, or implementing UX patterns across the UX Patterns for Developers corpus."
metadata:
  id: ux-patterns
  category: global
  source: uxpatterns.dev
  url: https://uxpatterns.dev/skills/ux-patterns
---

# UX Patterns Global

This skill aggregates 92 UX patterns across the site and helps choose the right implementation path without guessing from memory.

## Workflow

1. Start with the user problem, task flow, and constraints instead of jumping straight to a component.
2. Narrow candidate patterns by category, aliases, and related-pattern links.
3. Compare tradeoffs before implementation when multiple patterns could fit.
4. **Use an installed pattern skill** from `.agents/skills/<pattern-id>/` when it already exists in this repo (read `SKILL.md`, then `references/pattern.md`). If missing, install with
   `npx skills add https://github.com/thedaviddias/ux-patterns-for-developers --skill <pattern-id> --yes`
5. Validate accessibility, performance, and testing guidance before shipping.

## Installed pattern skills (Radarboard)

These UX Patterns skills live in-repo for atomic UI and forms work. Load the relevant one **before** reviewing or changing [`packages/ui`](packages/ui):

| Concern | Skill path |
| --- | --- |
| `Button` | [button](../button/SKILL.md) |
| `Input`, labels, single-line text | [text-field](../text-field/SKILL.md) |
| `Textarea` | [textarea](../textarea/SKILL.md) |
| `Switch` | [toggle](../toggle/SKILL.md) |
| `Tooltip*` | [tooltip](../tooltip/SKILL.md) |
| Field errors, `aria-invalid`, messaging | [form-validation](../form-validation/SKILL.md) |
| `Select*` | [selection-input](../selection-input/SKILL.md) |
| `SkeletonShimmer` | [skeleton](../skeleton/SKILL.md) |

Source files live under `packages/ui/src/` (e.g. `button/index.tsx`, `tooltip/index.tsx`).

### AI intelligence (assistant / Radarboard)

All **10** corpus skills in this category are installed. Use them when changing [`packages/assistant-ui`](packages/assistant-ui), [`packages/assistant-core`](packages/assistant-core), or AI-related settings.

| Concern | Skill | Primary code anchors |
| --- | --- | --- |
| Chat shell, layout, scroll | [ai-chat](../ai-chat/SKILL.md) | `assistant-ui/src/chat/chat-ui.tsx`, `chat-drawer.tsx`, `chat-sidebar.tsx`, `chat-messages.tsx` |
| Composer, attachments, shortcuts | [prompt-input](../prompt-input/SKILL.md) | `chat-composer.tsx`, `chat-shortcuts.tsx`, `assistant-core/src/attachments.ts` |
| Partial tokens, streaming UI | [streaming-response](../streaming-response/SKILL.md) | `chat-messages.tsx`, `chat-markdown.tsx` |
| Spinners, skeletons, progressive load | [ai-loading-states](../ai-loading-states/SKILL.md) | `chat-statusline.tsx`, `@radarboard/ui` `SkeletonShimmer`, widget loading |
| Failures, retries, rate limits | [ai-error-states](../ai-error-states/SKILL.md) | `chat-statusline.tsx`, `assistant-core/src/runtime.ts`, provider errors in UI |
| Chips, menus, completions | [ai-suggestions](../ai-suggestions/SKILL.md) | `chat-preset-chips.tsx`, `chat-insert-menu.tsx`, `chat-command-menu.tsx` |
| Model / provider pickers | [model-selector](../model-selector/SKILL.md) | `chat-model-selector.tsx`, `assistant-core/src/provider-selection.ts`, `model-preferences.ts` |
| Modes / presets (context shape) | [context-window](../context-window/SKILL.md) | `chat-mode-selector.tsx`, `chat-context.tsx`, `assistant-core/src/contracts.ts` |
| Thumbs, copy, regenerate | [response-feedback](../response-feedback/SKILL.md) | Message actions in `chat-messages.tsx` / composer affordances (add where missing) |
| Token / budget UI | [token-counter](../token-counter/SKILL.md) | `settings-ai.tsx`, future status HUD if exposed |

To install **other** categories, use the same `npx skills add … --skill <id> --yes` command and extend this doc.

## Coverage

- advanced: 3 patterns
- ai-intelligence: 10 patterns
- authentication: 7 patterns
- content-management: 7 patterns
- data-display: 12 patterns
- e-commerce: 3 patterns
- forms: 26 patterns
- media: 3 patterns
- navigation: 11 patterns
- social: 4 patterns
- user-feedback: 6 patterns

---

See `references/categories.md` for the pattern-by-category index.

Site index: https://uxpatterns.dev/llms-full.txt
