# Project Design System

## Purpose
- Keep Radarboard visually consistent across the product, marketing site, docs, and desktop surfaces.
- Favor small, deliberate improvements over broad redesigns.
- Use the existing design language already present in the repo before inventing new patterns.

## Brand
- Product name: `Radarboard`
- Company name: `David Dias Digital`
- Company website: [https://daviddias.digital](https://daviddias.digital)
- Do not use legacy product naming or rename disclaimers.

## Design Principles
- Modern, opinionated, and operational rather than generic SaaS.
- Product clarity before decoration.
- Show real use cases and real product surfaces early.
- Prefer semantic Tailwind classes and shared tokens over hardcoded values.
- Preserve a sharp, square-edged visual language unless a component already establishes a different pattern.
- Design for both light and dark themes using semantic colors.

## Tokens
- Source of truth for marketing tokens: [apps/marketing/app/globals.css](/Users/thedaviddias/Projects/radarboard/apps/marketing/app/globals.css)
- Use semantic colors such as `bg-background`, `bg-surface`, `text-foreground`, `text-muted`, `border-border`, `bg-accent`, `text-accent-light`, `bg-success`, and `bg-destructive`.
- Do not introduce hex colors in components.
- Do not use arbitrary Tailwind values like `text-[11px]`, `rounded-[2px]`, or `bg-[#111]`.

## Typography
- Use the project typography scale and shared font variables.
- Favor strong headlines, compact supporting copy, and restrained label text.
- Marketing copy should be specific and literal before it tries to be clever.
- Avoid overusing all-caps slogans unless the section already depends on that visual treatment.

## Layout
- Keep sections spacious but not bloated.
- Reuse the existing homepage rhythm: hero, product preview, proof, use cases, CTA.
- When improving a page, prefer tightening copy, hierarchy, and proof before changing structure.
- Prevent horizontal overflow with `min-w-0`, `truncate`, and `overflow-x-hidden` where needed.
- All scrollable containers must use `scrollbar-thin`.

## Components
- Reuse existing components and section patterns before adding new ones.
- Prefer semantic icon sizes: `icon-xs`, `icon-sm`, `icon-base`, `icon-lg`.
- Use standardized transitions such as `transition-interactive` when available.
- Keep cards and panels square with `rounded-none` or `rounded-item`.

## Marketing Site Guidance
- The marketing site should feel like a focused product site, not a generic landing template.
- Lead with one concrete promise and named tools or outcomes.
- Show proof early: integrations, widgets, open source status, platform support, docs, or founder/company trust.
- Product visuals should explain the product, not just decorate the page.
- Founder and company attribution should be present but compact.
- Keep product naming and company naming centralized in data files such as [apps/marketing/data/site.ts](/Users/thedaviddias/Projects/radarboard/apps/marketing/data/site.ts).

## Accessibility
- Meet a minimum contrast ratio of 4.5:1 for normal text.
- All interactive elements must have visible focus states.
- Prefer semantic HTML structure and clear link/button labeling.
- Do not communicate state with color alone.

## Content Voice
- Clear, direct, and operational.
- Prefer “what it does” over “how futuristic it sounds.”
- Mention the actual systems Radarboard connects to when useful.
- Avoid filler phrases, inflated claims, and vague productivity language.

## Implementation Rules
- Use `pnpm`, not `npm`.
- Follow repo UI standards from `AGENTS.md`.
- For rename-sensitive marketing copy, centralize shared values instead of hardcoding them across components.
