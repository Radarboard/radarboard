# Upgrade The Expenses Plugin Into A Full Cost Workspace

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md). It is written so a new contributor can resume the work using only this file and the current repository state.

## Purpose / Big Picture

Today the `expenses` plugin behaves like a minimal side-panel tracker. After this change, Radarboard users should be able to manage expenses in a full-screen three-pane workspace, edit complete expense records, group expenses with tags, set budgets, receive budget alerts, and pull monthly billing totals from connected Vercel and GitHub integrations. The outcome is observable in two ways: the plugin opens as a full-screen workspace with sidebar, list, and detail panes; and both the UI and MCP tools can read, edit, soft-delete, restore, budget, and sync expenses in a way that survives reloads and passes package tests.

## Scope

In scope:
- Upgrade the expenses plugin presentation from side-panel to full-screen three-pane workspace.
- Add richer data model support for tags, soft delete, billing sync metadata, URLs, and budget state.
- Add shared pure expense operations used by both React code and MCP tools.
- Add billing data sources for Vercel and GitHub integrations.
- Add filtering, sorting, trash mode, tag input, budget editing, and detail editing UI.
- Update the widget and MCP tools to respect the new data model and budget logic.
- Add or update automated tests for the new behavior.

Out of scope:
- Real-time billing polling beyond the existing fetch-and-cache model.
- Multi-currency conversion. The user-selected currency only affects formatting.
- Attachments, approvals, invoices, or historical charting.
- Broad redesign of unrelated plugin infrastructure.

## Progress

- [ ] 2026-03-26 00:00Z: Rewrite the existing implementation plan into a compliant ExecPlan.
- [ ] Implement Milestone 1: extend the data model and shared operations module.
- [ ] Implement Milestone 2: add Vercel and GitHub billing data sources with tests.
- [ ] Implement Milestone 3: update `use-expenses.ts`, MCP tools, and descriptor wiring.
- [ ] Implement Milestone 4: replace the current overlay with a three-pane workspace shell.
- [ ] Implement Milestone 5: add detail editing, tag input, and budget editor components.
- [ ] Implement Milestone 6: update the expenses widget to use currency formatting and budget state.
- [ ] Implement Milestone 7: run lint, typecheck, and tests across touched packages and resolve failures.
- [ ] Implement Milestone 8: document outcomes, residual gaps, and any follow-up work.

## Surprises & Discoveries

- Observation: The older plan for this work was implementation-dense but not self-contained enough for a cold restart.
  Evidence: It lacked `Progress`, `Decision Log`, `Surprises & Discoveries`, `Outcomes & Retrospective`, recovery guidance, and explicit validation behavior.

- Observation: The linked design doc already contains the domain rules that matter most for a successful implementation, especially billing sync semantics and the field-level data model.
  Evidence: [2026-03-21-expenses-plugin-improvements-design.md](/Users/thedaviddias/Projects/radarboard/docs/superpowers/specs/2026-03-21-expenses-plugin-improvements-design.md) defines the new `ExpenseEntry` fields, budget types, sync behavior, and three-pane layout intent.

## Decision Log

- Decision: Keep this plan in `docs/superpowers/specs` beside the existing design doc rather than moving it to a new planning directory.
  Rationale: Radarboard already stores design and plan documents here, and the repository-level `PLANS.md` standard now points to this location.
  Date/Author: 2026-03-26 / Codex

- Decision: Treat this rewritten plan as the repository’s first concrete example of the new ExecPlan standard.
  Rationale: Testing the standard against a real, non-trivial initiative is the best way to validate that `PLANS.md` is practical rather than aspirational.
  Date/Author: 2026-03-26 / Codex

## Outcomes & Retrospective

No implementation work has been completed from this plan yet. When work progresses, this section must summarize what shipped, what changed from the original intent, and what follow-up tasks remain.

## Context and Orientation

The expenses plugin lives under `packages/plugins/src/plugins/expenses/`. It currently provides a lightweight expense tracker with a smaller UI surface than the RSS and changelog-style full-screen plugins. This initiative upgrades it into a larger operational workspace.

There are three main code areas involved:

- `packages/plugins/src/plugins/expenses/`
  This contains the plugin descriptor, React hook, overlay UI, widget, tests, and MCP tools. The hook is the main source of persisted plugin state. The overlay is the interactive UI. The MCP tools provide command-based access to the same expense data.

- `packages/integrations/src/vercel/` and `packages/integrations/src/github/`
  These packages contain the integration data source registries used by the unified integration routes. Adding a `billing` data source here allows the expenses plugin to reuse existing credentials and fetch monthly billing totals.

- Shared plugin infrastructure already present in the repo
  The design references `ThreePaneWorkspace`, which is a full-screen layout pattern already used by other plugins. In this repository, “data source” means a descriptor registered by an integration package that can be fetched through the integration route using resolved credentials. “Soft delete” means an item remains stored with a timestamp in `deletedAt` instead of being removed immediately. “Budget alert state” means persisted bookkeeping that prevents repeated “80% reached” or “100% exceeded” notifications from firing on every update.

The linked design doc at [2026-03-21-expenses-plugin-improvements-design.md](/Users/thedaviddias/Projects/radarboard/docs/superpowers/specs/2026-03-21-expenses-plugin-improvements-design.md) is the source of truth for the intended feature set. This ExecPlan embeds the implementation path and validation details needed to complete the work.

## Plan of Work

The work should proceed in dependency order. First, extend the expenses data model and centralize pure operations into a shared module. That creates one consistent implementation of normalization, currency formatting, monthly cost conversion, billing sync merging, and soft-delete behavior that both the UI hook and MCP layer can reuse. Without this step, the UI and MCP tools are likely to drift.

Next, add billing data sources to the Vercel and GitHub integrations. This step is intentionally separate because it proves the external billing-fetch path before the plugin UI depends on it. Each integration should return a compact `{ total, breakdown }` shape that the expenses plugin can upsert into local state.

After the shared data model and external data sources exist, wire the new types and operations into `use-expenses.ts`, `mcp-tools.ts`, and the plugin descriptor. At that point the storage rules, tool behavior, and runtime sync path all become compatible with the richer expense model.

Only then should the UI be expanded. Replace the current overlay with a three-pane workspace shell first, then add the detail editing, tagging, trash mode, and budget editing components. This keeps the UI migration incremental: first the new layout, then the richer editing experience.

Finally, update the widget so it respects the same currency formatting, budget state, and soft-delete filtering as the main plugin. End by running package-level validation and documenting any remaining gaps in this plan.

## Milestones

## Milestone 1: Extend The Expense Data Model And Shared Operations

At the end of this milestone, the repository should contain a shared pure module for expense normalization, soft delete, restore, currency formatting, monthly cost conversion, and billing sync merging, along with updated types and tests. No UI changes are required yet. This milestone is complete when the shared logic is covered by tests and both future UI and MCP changes can depend on one source of truth.

Implementation guidance:
- Update `packages/plugins/src/plugins/expenses/types.ts` to add `CostBreakdownItem`, `ExpenseTag`, `Budget`, and `BudgetAlertState`.
- Extend `ExpenseEntry` with `tags`, `deletedAt`, `url`, `integrationSource`, and `costBreakdown`.
- Create `packages/plugins/src/plugins/expenses/expense-operations.ts` with pure helpers for ID generation, timestamp generation, normalization, soft delete, restore, currency formatting, monthly cost conversion, and billing sync upsert behavior.
- Create `packages/plugins/src/plugins/expenses/expense-operations.test.ts` covering legacy normalization, purge behavior, billing-cycle conversion, currency formatting, and sync-upsert logic.

Acceptance:
- The new shared module exists and has tests.
- Legacy expenses missing the new fields are normalized safely.
- Expenses soft-deleted more than 30 days ago are purged during normalization.
- Billing sync upsert behavior preserves user-edited fields that should not be overwritten.

## Milestone 2: Add Billing Data Sources For Vercel And GitHub

At the end of this milestone, the integrations layer should expose a `billing` data source for both Vercel and GitHub. The expenses plugin should not yet depend on the full UI being migrated. This milestone exists to prove the external data path and error-handling strategy independently.

Implementation guidance:
- Update `packages/integrations/src/vercel/api/data-sources.ts` to register a `billing` descriptor that resolves credentials, fetches the current month of charges, and aggregates them into `{ total, breakdown }`.
- Update `packages/integrations/src/github/api/data-sources.ts` to register a `billing` descriptor that resolves credentials, resolves an accessible organization, fetches billing usage, and aggregates per-product totals.
- Add tests under the relevant integration package test directories to cover aggregation, missing credentials, and 403 handling.

Acceptance:
- Each integration can return `configured: false` when not connected.
- Each integration can degrade gracefully when billing permissions are unavailable.
- The aggregation logic is covered by tests and produces a stable breakdown shape the plugin can consume.

## Milestone 3: Wire Shared Operations Into The Hook, MCP Tools, And Descriptor

At the end of this milestone, the runtime state layer and tooling layer should both understand the richer expense model. The plugin descriptor should also advertise the billing data sources so connection status and sync actions have a consistent source of truth.

Implementation guidance:
- Update `packages/plugins/src/plugins/expenses/use-expenses.ts` to normalize expenses on load, load and persist tags and budget state, add soft delete and restore operations, compute budget status, and support billing sync.
- Update `packages/plugins/src/plugins/expenses/mcp-tools.ts` to use shared normalization, expose the new expense fields, convert delete into soft delete, add restore and budget tools, and expose sync behavior.
- Update `packages/plugins/src/plugins/expenses/index.ts` so the plugin becomes full-screen and declares Vercel/GitHub billing data sources.
- Update `packages/plugins/src/plugins/expenses/mcp-tools.test.ts` to cover the richer commands.

Acceptance:
- UI state and MCP tools both operate on the same normalized expense model.
- Deleted expenses are hidden by default and recoverable through the restore path.
- Budget state can be stored and reported.
- Billing sync can upsert expenses using the integration source field.

## Milestone 4: Replace The Current Overlay With A Three-Pane Workspace Shell

At the end of this milestone, the expenses plugin should open in a full-screen three-pane workspace with a sidebar, list pane, and detail pane shell. The list and sidebar can still be simplified initially, but the layout shift must be complete and testable.

Implementation guidance:
- Add `packages/plugins/src/plugins/expenses/components/expense-sidebar.tsx`.
- Add `packages/plugins/src/plugins/expenses/components/expense-list.tsx`.
- Rewrite `packages/plugins/src/plugins/expenses/components/expenses-overlay.tsx` to use `ThreePaneWorkspace`, selection state, filtering state, and trash mode state.
- Reuse existing plugin design patterns from full-screen workspace plugins already in the repo.

Acceptance:
- Opening the expenses plugin shows three panes instead of the old side-panel experience.
- The list can select expenses and the selected expense controls the detail pane.
- The sidebar exposes summary and filtering controls.

## Milestone 5: Add Detail Editing, Tags, And Budget Editing

At the end of this milestone, a user should be able to edit a full expense record, manage tags, and set budgets from inside the workspace without leaving the plugin.

Implementation guidance:
- Add `packages/plugins/src/plugins/expenses/components/tag-input.tsx`.
- Add `packages/plugins/src/plugins/expenses/components/expense-detail-panel.tsx`.
- Add `packages/plugins/src/plugins/expenses/components/budget-editor.tsx`.
- Wire these components into `expenses-overlay.tsx` using hook-provided state and mutation methods.
- Ensure auto-detected expenses keep user-editable fields editable while cost remains sync-controlled when appropriate.

Acceptance:
- A user can edit title, category, notes, renewal date, URL, tags, and other supported fields.
- A user can add, remove, restore, and permanently delete expenses.
- Budget settings persist and display status.

## Milestone 6: Update The Widget To Respect Currency, Budget, And Trash State

At the end of this milestone, the smaller dashboard widget should not drift from the plugin’s new semantics.

Implementation guidance:
- Update `packages/plugins/src/plugins/expenses/widget.tsx` to filter out soft-deleted entries, use shared or equivalent currency formatting, read the configured currency, and surface budget status when available.

Acceptance:
- The widget no longer hardcodes dollar formatting.
- Deleted expenses do not appear.
- Budget information is surfaced when configured.

## Milestone 7: Validation, Cleanup, And Retrospective

At the end of this milestone, the touched packages should pass relevant tests and static checks, dead code from the earlier implementation should be removed, and this plan should be updated with the final outcome.

Implementation guidance:
- Remove obsolete helper implementations duplicated by `expense-operations.ts`.
- Confirm DB key usage is consistent between the React hook and MCP tools.
- Confirm the old side-panel-only UI code is fully removed.
- Run the commands listed in `Validation and Acceptance` and resolve failures.
- Update `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective`.

Acceptance:
- The packages touched by this work pass lint, typecheck, and test commands.
- The plan reflects the actual final state of the work.

## Concrete Steps

Run commands from the repository root unless another directory is specified.

For plugin implementation work:

    cd /Users/thedaviddias/Projects/radarboard/packages/plugins
    pnpm vitest run --reporter=verbose src/plugins/expenses
    pnpm tsc --noEmit

For integration implementation work:

    cd /Users/thedaviddias/Projects/radarboard/packages/integrations
    pnpm vitest run --reporter=verbose
    pnpm tsc --noEmit

For focused formatting and lint verification while iterating:

    cd /Users/thedaviddias/Projects/radarboard
    pnpm --filter @radarboard/plugins exec biome check packages/plugins/src/plugins/expenses
    pnpm --filter @radarboard/integrations exec biome check packages/integrations/src/vercel packages/integrations/src/github

If package script names differ in the current working tree, update this section in the plan before proceeding so the next contributor does not have to rediscover the right commands.

## Validation and Acceptance

Validation is not optional. The work is accepted only when all of the following are true:

- The expenses plugin opens as a full-screen three-pane workspace instead of the old side-panel interaction.
- Expenses can be created, selected, edited, soft-deleted, restored, and permanently deleted through the UI.
- MCP tools can list, add, update, soft-delete, restore, and summarize expenses using the richer model.
- Currency formatting respects the configured currency setting.
- Budget state persists and budget thresholds can be computed from current expense data.
- Vercel and GitHub billing sync paths degrade gracefully when credentials or permissions are missing.
- Relevant tests in `packages/plugins` and `packages/integrations` pass.
- Typechecking passes in touched packages.
- Linting or formatting checks pass for the touched paths.

Manual verification should include a real interaction sequence:

    1. Open the expenses plugin in the app.
    2. Add a manual expense and verify it appears in the list and detail pane.
    3. Apply a tag and category filter and verify the list responds.
    4. Soft-delete the expense, switch to trash mode, and restore it.
    5. Set a budget and verify budget status appears in the sidebar and summary outputs.
    6. If Vercel or GitHub credentials are configured, trigger sync and verify the auto-detected expense behavior.

If live credentials are not available, the sync path must still be validated through automated tests and graceful error handling.

## Idempotence and Recovery

Most editing work in this initiative should be additive and safe to repeat. Creating helper functions, adding tests, and replacing UI components can all be retried by re-running lint, tests, and typecheck after each correction.

Potentially risky areas:
- Billing data source registration can fail if action names or cache-key logic conflict with existing integration behavior.
- UI migration can temporarily break the expenses plugin if the descriptor presentation and overlay implementation get out of sync.
- Data migration behavior can accidentally hide or purge expense records if normalization rules are wrong.

Recovery guidance:
- Validate normalization and purge behavior with unit tests before wiring it into the hook.
- Keep the shared operations module pure and tested before using it in UI or MCP code.
- Land the three-pane shell before the rich detail editor so UI regressions are easier to isolate.
- If billing sync breaks, disable or stub the plugin-level sync call until the integration descriptors are corrected rather than shipping partial silent corruption.

## Artifacts and Notes

Important source files for this initiative:
- [2026-03-21-expenses-plugin-improvements-design.md](/Users/thedaviddias/Projects/radarboard/docs/superpowers/specs/2026-03-21-expenses-plugin-improvements-design.md)
- `packages/plugins/src/plugins/expenses/types.ts`
- `packages/plugins/src/plugins/expenses/use-expenses.ts`
- `packages/plugins/src/plugins/expenses/mcp-tools.ts`
- `packages/plugins/src/plugins/expenses/index.ts`
- `packages/plugins/src/plugins/expenses/components/expenses-overlay.tsx`
- `packages/plugins/src/plugins/expenses/widget.tsx`
- `packages/integrations/src/vercel/api/data-sources.ts`
- `packages/integrations/src/github/api/data-sources.ts`

The old implementation plan broke the work into eight phases. This rewritten ExecPlan preserves the same dependency structure but expresses it as milestone-driven narrative with explicit restart, validation, and recovery guidance.

## Interfaces and Dependencies

Internal dependencies:
- `packages/plugins/src/plugins/expenses/types.ts` must define the expanded expense model.
- `packages/plugins/src/plugins/expenses/expense-operations.ts` must become the shared pure logic layer used by both hook and MCP code.
- `packages/plugins/src/plugins/expenses/use-expenses.ts` must remain the canonical persisted-state hook for the plugin UI.
- `packages/plugins/src/plugins/expenses/mcp-tools.ts` must remain compatible with the same normalized data model as the hook.
- `packages/plugins/src/plugins/expenses/index.ts` must advertise the right presentation mode and data sources.

External and cross-package dependencies:
- Vercel billing data is fetched through `packages/integrations/src/vercel/api/data-sources.ts`.
- GitHub billing data is fetched through `packages/integrations/src/github/api/data-sources.ts`.
- The workspace UI depends on the existing `ThreePaneWorkspace` pattern already used elsewhere in the repo.

Interfaces that must exist by the end of the work include:
- A shared expense operations module exposing normalization, currency formatting, deletion, restoration, and sync helpers.
- A hook API in `use-expenses.ts` that supports tags, budget state, trash operations, and billing sync.
- MCP tool handlers that expose the richer expense model and budget-related operations.
- Integration data sources that return stable billing totals and breakdowns for the current month.

Revision note: 2026-03-26. Rewrote this older implementation plan into a compliant ExecPlan so it can serve as a real example of the repository’s new `PLANS.md` standard.
