# Top Bar Action Labels Design

**Date:** 2026-03-19
**Status:** Approved

## Overview

Update the dashboard top bar action buttons so `Edit`, `Assistant`, `Debug`, and `Settings`
use the same dark segmented-filter visual language as the currency controls on the same row.
Each action gets a short text label that can collapse as available horizontal space shrinks.

The approved interaction is **Option B: Priority Labels**:

- `Edit` and `Settings` keep their labels longer
- `Assistant` and `Debug` collapse to icon-only earlier
- all actions can still fall back to icon-only on tighter widths

## Changes

### 1. Top Bar Rendering (`packages/widgets/src/chrome/top-bar/index.tsx`)

- Replace the generic ghost/outline action buttons for the core top-bar actions with local
  filter-style action pills
- Keep `NotificationCenter` and other injected `actionsSlot` content unchanged
- Preserve existing `aria-label`, `title`, click handlers, and active-state semantics

### 2. Shared Local Styling Strategy (`packages/widgets/src/chrome/top-bar/index.tsx`)

- Keep this visual treatment local to `TopBar`
- Do not change the shared `Button` or `ToggleGroup` primitives
- Reuse the filter palette and border language:
  - dark border: `#333`
  - inactive text: muted gray
  - active state: white background with black text

### 3. Responsive Label Collapse (`packages/widgets/src/chrome/top-bar/index.tsx`)

- Use CSS breakpoint tiers rather than JS measurement
- `Edit` and `Settings` use the later-collapse tier
- `Assistant` and `Debug` use the earlier-collapse tier
- Icons always remain visible
- Ensure the right action row uses `min-w-0` and avoids horizontal overflow

### 4. Validation (`packages/widgets/src/chrome/top-bar/top-bar.test.ts`)

- Keep lightweight contract coverage for the top bar labels and action semantics
- Run targeted widget tests and type checks after the change

## Files Expected To Change

| File | Change |
|---|---|
| `packages/widgets/src/chrome/top-bar/index.tsx` | Replace action button rendering with local filter-style pills and responsive labels |
| `packages/widgets/src/chrome/top-bar/top-bar.test.ts` | Update contract expectations for the labeled action buttons |
