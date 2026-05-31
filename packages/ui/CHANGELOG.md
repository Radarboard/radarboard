# @radarboard/ui

## 0.1.1

### Patch Changes

- 520b374: Structured demo data registry, read-only sandbox mode (DemoGuard on all settings, edit mode blocked, AI chat disabled), mock plugin/notification data, TopBar demo badge, and E2E tests for the full demo flow.
- 520b374: Add DemoGuard component to prevent destructive actions in demo mode
- 520b374: Fix modal transparency, z-index stacking, and dimension stability for nested dialogs
- 520b374: Add integration registry edge-case coverage and adjust dialog overlay behavior.
- 520b374: Initialize Changesets-based internal version tracking, release-note enforcement, and release PR automation for Radarboard shared workspaces.
- 520b374: Add platform-aware clipboard utility to @radarboard/utils and migrate all packages to use it
- 520b374: Add uniform grid layouts (4x3, 4x4), Connect CTAs on empty widget slots, and settings badge for setup progress. Extract onboarding wizard into @radarboard/feature-onboarding package. Add 94%+ unit test coverage and fix e2e tests for 7-step wizard.
- f83fd04: Refresh direct dependency ranges and lockfiles across the workspace, and document the alpha, beta, and official desktop release flow.
- 520b374: Normalize shared tabs trigger button styling and add regression coverage.
- 520b374: Roll out shared Vitest configuration across internal workspaces, add targeted test coverage, and align package manifests with the new test setup.
- Updated dependencies [520b374]
- Updated dependencies [520b374]
- Updated dependencies [520b374]
- Updated dependencies [f83fd04]
- Updated dependencies [520b374]
- Updated dependencies [520b374]
  - @radarboard/types@0.1.1
  - @radarboard/utils@0.1.1
