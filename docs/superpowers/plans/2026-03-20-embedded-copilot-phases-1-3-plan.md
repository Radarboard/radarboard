# Embedded Copilot Platform Phases 1-3 — Implementation Plan

**Date:** 2026-03-20  
**Spec:** [2026-03-20-radarboard-embedded-copilot-platform-design.md](/Users/thedaviddias/Projects/radarboard/docs/superpowers/specs/2026-03-20-radarboard-embedded-copilot-platform-design.md)  
**Status:** Ready for implementation

---

## Objective

Implement the first execution slice of Radarboard's embedded copilot platform while keeping the scope strictly bounded to:

- Phase 1: Assistant Foundation
- Phase 2: Typing Workflow
- Phase 3: Artifacts + Minimum Observability

This slice should deliver:

- a deployment-level assistant module boundary
- package extraction for assistant domain logic and chat UI
- an upgraded typing workflow with presets, skills, and context chips
- quiet `Explore` / `Plan` artifact auto-save
- minimum run / retrieval / citation observability

This slice should not yet attempt:

- full knowledge registry UI
- knowledge health dashboard
- expanded sync platform
- voice mode
- full evaluation suite

---

## Current Groundwork

Radarboard already has usable foundations that this plan should reuse rather than replace:

- assistant conversations, messages, memory, custom skills, and artifacts persist through the existing LLM repository layer
- chat UI already supports:
  - modes
  - model selection
  - thread history
  - image/file attachment
  - project mentions
  - insertable notes / artifacts / project context
- assistant workflows already exist for:
  - `default`
  - `explore`
  - `plan`
  - `review`
  - `qa`
- the spec is committed in `c3ae8fe`

This means the first slice should focus on packaging, contract freezing, and UX/system upgrades, not on rebuilding assistant storage from scratch.

---

## Delivery Sequence

### Phase 1 — Assistant foundation and module isolation

Primary files:

- new `packages/assistant-core/package.json`
- new `packages/assistant-core/tsconfig.json`
- new `packages/assistant-core/src/index.ts`
- new `packages/assistant-core/src/contracts.ts`
- new `packages/assistant-core/src/lifecycle.ts`
- new `packages/assistant-core/src/presets.ts`
- new `packages/assistant-core/src/attachments.ts`
- new `packages/assistant-ui/package.json`
- new `packages/assistant-ui/tsconfig.json`
- new `packages/assistant-ui/src/index.ts`
- `apps/app/components/dashboard/dashboard/index.tsx`
- `apps/app/components/plugins/plugin-launcher/index.tsx`
- `apps/app/components/settings/settings-modal/index.tsx`
- `apps/app/components/settings/settings-sidebar/index.tsx`
- `apps/app/app/api/chat/route.ts`
- `apps/app/app/api/chat/conversations/route.ts`
- `apps/app/app/api/chat/conversations/[id]/route.ts`
- `apps/app/app/api/chat/conversations/[id]/extract/route.ts`
- `apps/app/app/api/chat/artifacts/route.ts`
- `apps/app/app/api/chat/artifacts/[id]/route.ts`
- `apps/app/app/api/chat/memory/route.ts`
- `apps/app/app/api/chat/models/route.ts`
- `apps/app/app/api/chat/projects/route.ts`
- new `apps/app/lib/assistant-config.ts`
- `apps/app/app/providers.tsx`

Work:

1. Create `assistant-core` and freeze the canonical contracts from the spec:
   - `AssistantRun`
   - `RetrievalAction`
   - `KnowledgeSource`
   - `ArtifactRecord`
   - `CitationRecord`
   - `AssistantPreset`
   - `Skill`
   - `AssistantAttachment`
   - `RecommendationRecord`
   - `RecommendationFeedback`
2. Move chat-specific React components from `apps/app/components/chat/*` into `assistant-ui` without changing behavior first.
3. Add one deployment-level feature flag in `apps/app`, for example `ASSISTANT_ENABLED`.
4. Gate assistant mount points:
   - dashboard drawer
   - launcher action
   - settings section
5. Gate `/api/chat/*` routes to return `404` when the module is disabled.
6. Ensure no assistant client code mounts when disabled beyond tiny flag checks and lazy-import boundaries.

Exit criteria:

- assistant can be disabled per deployment
- assistant UI is package-owned instead of app-folder-owned
- chat routes behave consistently when disabled
- dashboard shell still renders without assistant code paths

### Phase 2 — Canonical persistence and migration groundwork

Primary files:

- `packages/types/src/database.ts`
- `packages/llm/src/types.ts`
- `apps/app/db/schema.ts`
- `apps/app/app/api/database/migrate/route.ts`
- `apps/app/db/sqlite-llm.ts`
- `apps/app/db/supabase-llm.ts`
- `apps/app/db/turso-llm.ts`
- `apps/app/db/planetscale-llm.ts`
- `apps/app/db/repository.ts`
- new tests in:
  - `apps/app/db/sqlite-llm.test.ts`
  - provider-specific LLM repo tests

Work:

1. Add the minimum new persistence fields for Phases 1-3:
   - run-level lineage
   - artifact `sourceRunId`
   - artifact `traceId`
   - artifact `citationIds`
   - artifact `evidenceSourceIds`
   - artifact `partialReason`
2. Add run persistence and retrieval action persistence using the existing LLM repository path or a thin assistant repository wrapper backed by it.
3. Add preset persistence, attachment persistence, citation persistence, and trace-root persistence.
4. Keep existing conversations and artifacts readable:
   - add nullable backfill fields
   - keep legacy artifacts in compatibility mode
5. Do not reshape old message storage unless strictly required for background runs.

Exit criteria:

- legacy chat data remains readable
- new assistant contracts can be persisted without inventing per-feature storage ad hoc
- migrations are additive and backward-compatible

### Phase 3 — Route orchestration and assistant lifecycle

Primary files:

- `apps/app/app/api/chat/route.ts`
- `apps/app/lib/ai-tools.ts`
- `apps/app/lib/assistant-workflows.ts`
- `apps/app/lib/memory-service.ts`
- `apps/app/lib/mcp-bridge.ts`
- `apps/app/lib/plugin-tool-bridge.ts`
- new `apps/app/lib/assistant-run-service.ts`
- new `apps/app/lib/assistant-trace-service.ts`
- new route tests under `apps/app/app/api/chat/*.test.ts`

Work:

1. Refactor chat orchestration behind an assistant-run service that:
   - starts a run
   - resolves attachments/preset context
   - records retrieval actions
   - records trace/citation metadata
   - finalizes run state
2. Preserve current tool availability while routing lifecycle writes through the new contracts.
3. Support chat-originated runs and background-task runs cleanly:
   - `conversationId` / `messageId` nullable only for `background_task`
4. Implement canonical lifecycle transitions:
   - `started`
   - `completed`
   - `needs_input`
   - `failed`
   - `cancelled`
5. Handle interruptions:
   - user stop
   - module disabled mid-run
   - queued background task cancelled before start

Exit criteria:

- run lifecycle is explicit and testable
- retrieval and citations are captured from the same orchestration layer
- background runs no longer depend on synthetic chat rows

### Phase 4 — Assistant UI extraction compatibility layer

Primary files:

- new `packages/assistant-ui/src/chat/*`
- `apps/app/components/dashboard/dashboard/index.tsx`
- `apps/app/components/settings/settings-ai.tsx`
- `apps/app/app/providers.tsx`
- `apps/app/components/plugins/plugin-launcher/index.tsx`
- `apps/app/components/settings/settings-modal/index.tsx`

Work:

1. Replace direct app-local imports with package exports from `assistant-ui`.
2. Keep visual behavior stable first:
   - drawer
   - sidebar
   - messages
   - model selector
   - artifacts panel
3. Leave the app-level settings shell in `apps/app`, but move assistant-specific reusable UI pieces into the package if they are not web-route dependent.
4. Ensure the package boundary does not import app-local repositories or Next route code.

Exit criteria:

- the app consumes assistant UI from one package boundary
- packaging change does not cause user-visible regressions

### Phase 5 — Typing workflow upgrade

Primary files:

- `packages/assistant-ui/src/chat/chat-composer.tsx`
- `packages/assistant-ui/src/chat/chat-command-menu.tsx`
- `packages/assistant-ui/src/chat/chat-insert-data.ts`
- `packages/assistant-ui/src/chat/chat-context.tsx`
- `packages/assistant-ui/src/chat/chat-store.ts`
- new `packages/assistant-ui/src/chat/chat-context-chips.tsx`
- new `packages/assistant-ui/src/chat/chat-preset-chips.tsx`
- new `packages/assistant-ui/src/chat/chat-skill-picker.tsx`
- `apps/app/components/settings/settings-ai.tsx`
- `apps/app/app/api/chat/skills/route.ts`
- new `apps/app/app/api/chat/presets/route.ts`
- supporting tests in `assistant-ui` and route tests in `apps/app`

Work:

1. Add prompt preset chips to the composer.
2. Add `$skill` attachment UX.
3. Expand slash insertion to support:
   - presets
   - notes
   - artifacts
   - docs
   - goals
   - memory
4. Add removable context chips above the composer.
5. Add assistant preset persistence and resolution:
   - base model
   - default mode
   - retrieval domains
   - web search policy
   - default skills
6. Keep advanced skill-management features out of this slice:
   - clone
   - import/export
   - detailed usage reporting

Exit criteria:

- a user can stay in the prompt box and still attach project scope, skills, and reusable context
- runtime config precedence is deterministic and testable

### Phase 6 — Ghost-text autocomplete

Primary files:

- `packages/assistant-ui/src/chat/chat-composer.tsx`
- new `packages/assistant-ui/src/chat/use-ghost-completion.ts`
- new `apps/app/app/api/chat/autocomplete/route.ts`
- `apps/app/lib/assistant-run-service.ts`
- tests for autocomplete route and hook behavior

Work:

1. Add a small-model autocomplete route.
2. Scope it to the current project, mode, and resolved preset.
3. Debounce requests and render ghost text inline.
4. Accept with `Tab`; ignore on continued typing.
5. Keep it lightweight:
   - no web search
   - no heavy retrieval
   - project-native context only in this slice

Exit criteria:

- autocomplete improves typing without feeling like a second chat session
- it can be disabled cleanly with the assistant flag

### Phase 7 — Quiet artifact auto-save and minimum observability

Primary files:

- `apps/app/lib/assistant-run-service.ts`
- `apps/app/lib/assistant-trace-service.ts`
- `apps/app/lib/assistant-workflows.ts`
- `apps/app/app/api/chat/route.ts`
- `apps/app/app/api/chat/artifacts/route.ts`
- `packages/assistant-ui/src/chat/chat-artifacts.tsx`
- `packages/assistant-ui/src/chat/chat-messages.tsx`
- `packages/assistant-ui/src/chat/chat-statusline.tsx`
- `apps/app/components/debug/sections/traces/index.tsx`
- new debug/trace read routes if needed

Work:

1. Implement auto-save threshold for `Explore` and `Plan`.
2. Save artifacts by `sourceRunId` dedupe.
3. Persist:
   - body
   - title
   - summary
   - status
   - citations
   - evidence source IDs
   - trace ID
   - partial reason
4. Record retrieval actions and citations per run.
5. Show non-blocking save success/failure states in the UI.
6. Expose minimum trace inspection for development/debug use.

Exit criteria:

- `Explore` and `Plan` results produce durable artifacts without interrupting flow
- every saved artifact is traceable back to a run and its evidence

### Phase 8 — Verification and cleanup

Primary files:

- focused tests across `packages/assistant-core`
- focused tests across `packages/assistant-ui`
- route tests in `apps/app/app/api/chat/*`
- repository tests in `apps/app/db/*`

Work:

1. Add lifecycle tests for:
   - run start / complete / needs_input / failed / cancelled
   - retrieval action recording
   - interrupt behavior
2. Add artifact tests for:
   - save threshold
   - dedupe by `sourceRunId`
   - partial save
   - failure non-blocking behavior
3. Add disablement tests for:
   - hidden UI
   - `404` routes
   - no background task execution
4. Add migration tests for:
   - legacy conversations
   - legacy artifacts without lineage
5. Run focused checks:
   - `pnpm --filter @radarboard/integrations typecheck`
   - `pnpm --filter @radarboard/app typecheck`
   - `pnpm --filter @radarboard/app test`
   - package-level checks for new assistant packages once added

Exit criteria:

- package split is stable
- assistant disablement is reliable
- typing workflow improvements and artifact auto-save are covered by tests

---

## Suggested Commit Slices

1. `assistant-foundation`
   - add `assistant-core`
   - add deployment flag
   - gate mount points and routes
2. `assistant-persistence`
   - add migrations
   - add repositories / wrappers
   - preserve legacy data compatibility
3. `assistant-ui-extraction`
   - move chat UI into `assistant-ui`
   - keep behavior stable
4. `assistant-presets-and-attachments`
   - presets
   - attachment precedence
   - context chips
5. `assistant-autocomplete`
   - ghost text
   - autocomplete route
6. `assistant-artifacts-and-traces`
   - auto-save
   - citations
   - run / retrieval observability

This keeps the riskiest architecture work separated from the visible UX changes.

---

## Risks To Watch

- package extraction that accidentally keeps hidden app-local coupling
- schema drift between legacy assistant rows and new run/trace/citation data
- overbuilding skill-management UI during the typing slice
- mixing Phase 4+ knowledge-registry concerns into the Phase 1-3 implementation
- attempting full evaluation infrastructure before the minimum run/citation pipeline is stable

---

## Known Constraints

- The repo has unrelated working-tree changes outside this plan scope. Do not fold them into assistant commits.
- The OpenPanel descriptor parser break and related integration typing issues were fixed locally during this planning turn, but those code changes are separate from the plan document and should be reviewed independently before commit selection.

---

## Acceptance Boundary

This plan is done when Radarboard has:

- an optional deployment-level assistant module
- assistant UI extracted into a package boundary
- canonical run / artifact / citation / preset / attachment contracts
- an upgraded typing workflow with presets, `$skill`, and context chips
- ghost-text autocomplete
- quiet `Explore` / `Plan` artifact auto-save
- minimum run / retrieval / citation observability

That is the full boundary for the first implementation slice. Everything else stays out.
