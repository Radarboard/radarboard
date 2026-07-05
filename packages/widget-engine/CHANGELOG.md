# @radarboard/widget-engine

## 0.2.0

### Minor Changes

- 520b374: Structured demo data registry, read-only sandbox mode (DemoGuard on all settings, edit mode blocked, AI chat disabled), mock plugin/notification data, TopBar demo badge, and E2E tests for the full demo flow.
- 520b374: Add uniform grid layouts (4x3, 4x4), Connect CTAs on empty widget slots, and settings badge for setup progress. Extract onboarding wizard into @radarboard/feature-onboarding package. Add 94%+ unit test coverage and fix e2e tests for 7-step wizard.
- 520b374: Add WidgetNotConfigured component and onConnectService prop to WidgetRenderProps

### Patch Changes

- 520b374: Export runWidgetConformance via ./conformance subpath for downstream widget packages
- 520b374: Add widget conformance tests, fix pre-existing test failures, remove dangling data-resolver exports
- 520b374: Initialize Changesets-based internal version tracking, release-note enforcement, and release PR automation for Radarboard shared workspaces.
- 520b374: Minor fixes to onboarding wizard, chat composer, and widget demo data
- 520b374: Add platform-aware clipboard utility to @radarboard/utils and migrate all packages to use it
- 520b374: Stabilize quality gates, fix typecheck and test drift, and restore clean repo builds.
- f83fd04: Refresh direct dependency ranges and lockfiles across the workspace, and document the alpha, beta, and official desktop release flow.
- 520b374: Add workspace test coverage and align dashboard settings access with the dock entry point
- 520b374: Roll out shared Vitest configuration across internal workspaces, add targeted test coverage, and align package manifests with the new test setup.
- Updated dependencies [520b374]
- Updated dependencies [520b374]
- Updated dependencies [520b374]
- Updated dependencies [520b374]
- Updated dependencies [520b374]
- Updated dependencies [520b374]
- Updated dependencies [520b374]
- Updated dependencies [520b374]
- Updated dependencies [520b374]
- Updated dependencies [520b374]
- Updated dependencies [f83fd04]
- Updated dependencies [520b374]
- Updated dependencies [449a71e]
- Updated dependencies [520b374]
- Updated dependencies [520b374]
- Updated dependencies [520b374]
  - @radarboard/hooks@0.1.1
  - @radarboard/ui@0.1.1
  - @radarboard/charts@0.1.1
  - @radarboard/types@0.2.0
  - @radarboard/utils@0.1.1
  - @radarboard/widget-sdk@0.1.1
