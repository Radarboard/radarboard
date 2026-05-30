# Feature Descriptor System — Architecture Design

## Status: Partially Implemented

### Progress (as of 2026-03-24)

| Phase | Feature | Status | Details |
|-------|---------|--------|---------|
| 1 | `feature-sdk` | Done | Types, registry, resolution in `packages/feature-sdk/` |
| 2 | Workflows | Done | Full isolation — engine, scheduler, repository, tools, tests in `features/workflows/` |
| 3 | Briefing | Done | Core logic + AI tool executor in `features/briefing/` |
| 4 | Notifications | Descriptor only | Business logic stays in `apps/app` (infrastructure used by 10+ files) |
| — | Assistant | Descriptor only | Code deeply tangled across `ai-tools.ts`, `ai-actions/`, `app/api/chat/` |
| — | Skills | Descriptor only | Depends on assistant |
| — | MCP Servers | Descriptor only | |
| — | Memory | Descriptor only | |
| — | Onboarding | Inline | System-tier, not user-toggleable |
| — | Demo Mode | Inline | System-tier, not user-toggleable |

## Problem

Features like assistant, workflows, briefing, and notifications live inside `apps/app/`
as tangled code. They share files, import each other freely, and have no boundary
enforcement. This makes it impossible to guarantee that disabling one feature won't
break another.

Meanwhile, plugins, widgets, and integrations are fully isolated packages with:
- Typed descriptors declaring capabilities
- Registry-based registration
- Boundary enforcement (biome + check-module-boundaries.ts)
- Codegen from `radarboard.config.ts`

Features should follow the same pattern.

## Current State (as of 2026-03-24)

The feature flag system provides two-tier gating:
- **System flags**: env-var only (onboarding, demoMode)
- **User flags**: env + user preference stored in DB (assistant, skills, workflows, etc.)

The registry in `apps/app/lib/features.ts` declares what each feature gates:
- `settingsSections` — sidebar sections to hide
- `gatedTools` — AI tool names to filter

But the **actual code** for each feature is scattered:
- Assistant: `lib/ai-tools.ts`, `lib/ai-actions/`, `app/api/chat/`, `packages/assistant-ui/`, `packages/llm/`
- Workflows: `lib/workflow-engine.ts`, `lib/ai-actions/workflow-tools.ts`, `app/api/workflows/`, `components/settings/settings-workflows/`
- Briefing: `lib/morning-briefing.ts`, `app/api/briefing/`
- Notifications: `app/api/notifications/` (8 routes), `components/settings/settings-notifications/`, `lib/notifications.ts`

## Proposed Architecture

### FeatureDescriptor Interface

Following the exact pattern of `PluginDescriptor`, `WidgetDescriptor`, and `IntegrationDescriptor`:

```typescript
// packages/feature-sdk/src/types.ts

export interface FeatureDescriptor {
  /** Unique feature identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** Short description for settings UI. */
  description: string;
  /** Icon component (lucide-react). */
  icon: ComponentType;

  // --- Gating ---

  /** "system" = maintainer-only. "user" = user-togglable with env override. */
  tier: "system" | "user";
  /** Environment variable name. */
  envKey: string;
  /** Default enabled state when no env var or user preference is set. */
  defaultEnabled: boolean;

  // --- What this feature provides ---

  /** Settings sidebar sections this feature owns. Hidden when disabled. */
  settingsSections?: string[];
  /** Settings panel component. Lazy-loaded. */
  settingsComponent?: () => Promise<{ default: ComponentType }>;
  /** AI tool names gated behind this feature. */
  gatedTools?: string[];
  /** API route prefixes gated behind this feature (e.g., "/api/workflows"). */
  gatedApiPrefixes?: string[];

  // --- Dependencies ---

  /** Other features this one depends on. If parent is disabled, child is too. */
  requires?: string[];
}
```

### Feature Registry

```typescript
// packages/feature-sdk/src/registry.ts

export const FEATURE_REGISTRY = new Map<string, FeatureDescriptor>();

export function registerFeature(descriptor: FeatureDescriptor): void {
  if (FEATURE_REGISTRY.has(descriptor.id)) return; // Idempotent (HMR-safe)
  FEATURE_REGISTRY.set(descriptor.id, descriptor);
}
```

### Directory Structure

```
features/
  assistant/
    package.json          # @radarboard/feature-assistant
    src/
      index.ts            # exports assistantDescriptor
      tools.ts            # AI tool definitions
      settings.tsx        # Settings panel (lazy-loaded)
  workflows/
    package.json          # @radarboard/feature-workflows
    src/
      index.ts            # exports workflowsDescriptor
      engine.ts           # Workflow engine
      tools.ts            # AI tool definitions
      settings.tsx        # Settings panel
  briefing/
    package.json
    src/
      index.ts
      morning-briefing.ts
  notifications/
    package.json
    src/
      index.ts
      settings.tsx
packages/
  feature-sdk/            # Shared types, registry, resolution logic
    src/
      types.ts
      registry.ts
      resolution.ts       # resolveFeatureEnabled, getDisabledSections, etc.
```

### Registration via radarboard.config.ts

```typescript
// radarboard.config.ts (existing file, add features section)
export default {
  integrations: [...],
  plugins: [...],
  widgets: [...],
  features: [
    { package: "@radarboard/feature-assistant" },
    { package: "@radarboard/feature-workflows" },
    { package: "@radarboard/feature-briefing" },
    { package: "@radarboard/feature-notifications" },
    // System features:
    { package: "@radarboard/feature-onboarding" },
    { package: "@radarboard/feature-demo-mode" },
  ],
};
```

### Codegen: features-init.ts

`scripts/generate-extensions-init.ts` already generates init files for plugins,
widgets, and integrations. Extend it to also generate `apps/app/lib/features-init.ts`:

```typescript
// Auto-generated — do not edit
import { assistantDescriptor } from "@radarboard/feature-assistant";
import { workflowsDescriptor } from "@radarboard/feature-workflows";
import { registerFeature } from "@radarboard/feature-sdk/registry";

registerFeature(assistantDescriptor);
registerFeature(workflowsDescriptor);
// ...
```

### Boundary Enforcement

Add features to the existing boundary enforcement:

1. **biome.json**: Add `features/*/src/**` to `noRestrictedImports` overrides
2. **check-module-boundaries.ts**: Add `features` category with allowed deps:
   `[feature-sdk, types, utils, ui]`

### Dependency Declaration

The `requires` field handles feature dependencies:

```typescript
export const skillsDescriptor: FeatureDescriptor = {
  id: "skills",
  requires: ["assistant"], // If assistant is disabled, skills is too
  // ...
};
```

Resolution logic checks the dependency chain:
```typescript
function resolveFeatureEnabled(id, userPrefs) {
  const descriptor = FEATURE_REGISTRY.get(id);
  if (!descriptor) return false;
  // Check own gate
  if (!checkOwnGate(descriptor, userPrefs)) return false;
  // Check dependencies recursively
  if (descriptor.requires) {
    for (const dep of descriptor.requires) {
      if (!resolveFeatureEnabled(dep, userPrefs)) return false;
    }
  }
  return true;
}
```

## Migration Path

### Phase 1: Feature SDK package (foundation)
- Create `packages/feature-sdk/` with types, registry, resolution logic
- Move current `FEATURE_REGISTRY` from `apps/app/lib/features.ts` to the SDK
- Keep existing features inline — they just register via descriptors

### Phase 2: Migrate workflows (smallest feature)
- Create `features/workflows/` package
- Move `lib/workflow-engine.ts`, `lib/ai-actions/workflow-tools.ts`, `app/api/workflows/route.ts`, `components/settings/settings-workflows/` into the package
- Export `workflowsDescriptor` from `features/workflows/src/index.ts`
- Update `radarboard.config.ts` and run codegen

### Phase 3: Migrate briefing
- Create `features/briefing/` package
- Move `lib/morning-briefing.ts`, `app/api/briefing/route.ts`

### Phase 4: Migrate notifications
- Create `features/notifications/` package
- Move all 8 notification routes + settings component + lib/notifications.ts

### Phase 5: Migrate assistant (largest, most tangled)
- Create `features/assistant/` package
- This is the hardest because assistant code spans many files
- May require extracting shared types into `packages/types/`

### Phase 6: Boundary enforcement
- Add features to `check-module-boundaries.ts` ALLOWED_WORKSPACE_DEPS
- Add biome `noRestrictedImports` rules for `features/*/src/**`
- CI now prevents cross-feature imports

## Testing Strategy

With isolated feature packages, testing becomes straightforward:

1. **Package-level unit tests**: Each `features/*/` has its own test suite
2. **Registry tests**: Verify all descriptors register correctly
3. **Smoke tests** (existing): Verify disabling each feature doesn't affect others
4. **E2E**: Playwright test that toggles each feature off and verifies no crash
5. **CI matrix**: Run full suite with `NEXT_PUBLIC_FEATURE_X=false` for each feature

## What This Enables

- **True isolation**: Features cannot import from each other (enforced by linter + boundary script)
- **Safe toggling**: Disabling a feature only removes its own code paths
- **Discoverability**: `FEATURE_REGISTRY` is the single source of truth for all features
- **Consistency**: Features follow the same patterns as plugins, widgets, and integrations
- **Testability**: Each feature is independently testable
- **Extensibility**: Adding a new feature = create package, export descriptor, add to config
