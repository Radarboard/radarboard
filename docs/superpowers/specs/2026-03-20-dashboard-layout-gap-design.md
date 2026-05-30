# Dashboard Layout Gap Design

**Date:** 2026-03-20
**Status:** Approved

## Overview

Increase the visual separation between dashboard layout cells on the live dashboard only.

The approved direction is:

- keep the change scoped to the runtime dashboard surface
- use a real inter-cell gutter instead of adding inner widget padding
- target the recommended subtle spacing level from the visual comparison
- keep settings editors and configuration previews unchanged

## Changes

### 1. Shared Dashboard Gap Token

- Define a shared dashboard cell gap token in global dashboard styles
- Use `6px` as the default gutter value
- Let stacked grid layouts and loading states inherit the same spacing

### 2. Desktop Dashboard Cell Positioning

- Update desktop absolute-positioned cells to subtract the shared gutter from width and height
- Preserve flush outer edges while increasing only the visible space between adjacent cells
- Do not change widget internals, card padding, or cell content layout

### 3. Dashboard Transition Consistency

- Apply the same gutter to the project-switch skeleton overlay
- Avoid a visual snap from spaced cells back to tight cells during project transitions

## Validation

- Verify desktop dashboard cells have a visibly clearer boundary
- Verify tablet/mobile stacked dashboard cells use the same `6px` gap
- Verify project-switch loading overlay matches the live dashboard spacing
- Verify settings layout editors and previews remain unchanged
