# @radarboard/assistant-ui

## 0.1.1

### Patch Changes

- 0ed20d6: Emit a `radarboard:dashboard-changed` window event when an assistant tool reports it mutated the dashboard (via a `dashboardChanged` flag on its output), so the host app can refresh the dashboard layout live without a reload.
- 520b374: Initialize Changesets-based internal version tracking, release-note enforcement, and release PR automation for Radarboard shared workspaces.
- 520b374: Minor fixes to onboarding wizard, chat composer, and widget demo data
- 520b374: Add platform-aware clipboard utility to @radarboard/utils and migrate all packages to use it
- f83fd04: Refresh direct dependency ranges and lockfiles across the workspace, and document the alpha, beta, and official desktop release flow.
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
  - @radarboard/hooks@0.1.1
  - @radarboard/ui@0.1.1
  - @radarboard/assistant-core@0.1.1
  - @radarboard/llm@0.1.1
  - @radarboard/plugin-sdk@0.1.1
  - @radarboard/types@0.2.0
  - @radarboard/utils@0.1.1
