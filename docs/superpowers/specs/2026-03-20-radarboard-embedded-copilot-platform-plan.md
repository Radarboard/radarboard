# Deliver Embedded Copilot Foundation, Typing Workflow, And Minimum Observability

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md). It is written so a new contributor can resume the work using only this file and the current repository state.

## Purpose / Big Picture

Radarboard should evolve from “dashboard with chat” into a dashboard-first embedded copilot that is project-aware, traceable, and capable of turning structured assistant work into durable assets. This first implementation slice does not attempt the entire multi-phase program. It covers only the first approved planning boundary from the design: Assistant Foundation, Typing Workflow, and Artifacts + Minimum Observability.

After this slice lands, the observable outcome should be:
- the assistant can be disabled cleanly at deployment level;
- assistant logic and UI are separated by clearer package boundaries;
- the composer becomes more expressive through presets, skill attachment, context chips, and typing-assist affordances without turning into a command console;
- `Explore` and `Plan` runs can auto-save substantial outputs as artifacts in the background;
- runs carry enough lineage, retrieval, citation, and version metadata to support later observability and evaluation work.

This is successful when the existing `/api/chat/*` behavior remains compatible, conversations and legacy artifacts remain readable, the assistant module can be gated off without leaving broken UI or routes behind, and the first structured artifact save and run-lineage flows are demonstrably working.

## Scope

In scope:
- Assistant module isolation and deployment-level enable/disable behavior.
- Clarifying package responsibilities between `packages/assistant-core`, `packages/assistant-ui`, and `apps/app`.
- Canonical assistant run, retrieval, artifact, preset, attachment, and trace contracts required for Phases 1 through 3.
- Typing workflow improvements: calmer composer posture, contextual attachments, skill and preset flows, and mode-aware composer behavior.
- Background artifact auto-save for substantial `Explore` and `Plan` outputs.
- Minimum observability and lineage: run IDs, source run linkage, retrieval action capture, citation capture, and prompt/preset/skill version references.
- Compatibility-preserving migrations for existing conversations and artifacts.

Out of scope:
- Knowledge registry implementation beyond the metadata and contracts needed to support future phases.
- Full live retrieval and web research expansion.
- Full observability explorer UI, evaluation cases, and knowledge health dashboards.
- Voice mode.
- Broad feature parity with Open WebUI or a standalone assistant workspace.

## Progress

- [ ] 2026-03-26 00:00Z: Create a feature-scale ExecPlan from the embedded copilot platform design.
- [ ] Implement Milestone 1: assistant module isolation and canonical contracts.
- [ ] Implement Milestone 2: typing workflow improvements in the composer and preset/skill flows.
- [ ] Implement Milestone 3: artifact auto-save and minimum run observability.
- [ ] Implement Milestone 4: migration, compatibility, and deployment-flag behavior verification.
- [ ] Implement Milestone 5: document outcomes, residual gaps, and the next planning boundary.

## Surprises & Discoveries

- Observation: The repository already contains `packages/assistant-core`, `packages/assistant-ui`, multiple `/api/chat/*` routes, and supporting app-side assistant code.
  Evidence: The current tree includes `packages/assistant-core/src/*`, `packages/assistant-ui/src/chat/*`, `apps/app/app/api/chat/*`, and app-side helper files such as `apps/app/lib/assistant-config.ts`, `apps/app/lib/assistant-context-cache.ts`, and `apps/app/lib/memory-service.ts`.

- Observation: The approved design explicitly says the first implementation plan must stop after Phase 3.
  Evidence: The design’s `Next Planning Boundary` section says the next implementation-planning artifact should cover only Phase 1: Assistant Foundation, Phase 2: Typing Workflow, and Phase 3: Artifacts + Minimum Observability.

- Observation: This initiative is not greenfield. The main challenge is controlled re-architecture with compatibility guarantees, not initial scaffolding.
  Evidence: Existing routes, packages, settings surfaces, and artifact/chat infrastructure already exist and must keep working during the migration.

## Decision Log

- Decision: Bound this ExecPlan to Phases 1 through 3 only.
  Rationale: The design explicitly requires later phases to remain program direction rather than part of the first implementation plan.
  Date/Author: 2026-03-26 / Codex

- Decision: Treat this as a migration and compatibility initiative, not a rewrite.
  Rationale: The assistant already exists in the repo, and the design mandates stable route behavior and preservation of existing assistant data wherever possible.
  Date/Author: 2026-03-26 / Codex

- Decision: Keep dashboard primacy as an acceptance criterion, not just a design aspiration.
  Rationale: Product drift is one of the explicit risks called out in the design, and the deployment flag plus package boundaries are part of the mitigation.
  Date/Author: 2026-03-26 / Codex

## Outcomes & Retrospective

No implementation work has been completed from this plan yet. When the work progresses, this section must summarize what shipped, what changed from the original intent, and which follow-up slices should come next.

## Context and Orientation

The assistant subsystem already spans packages and app-specific infrastructure:

- `packages/assistant-core/`
  This already contains assistant domain logic and helper modules such as `contracts.ts`, `runtime.ts`, `assistant-workflows.ts`, `attachments.ts`, `presets.ts`, and trace-related helpers. This package should become the clear home for shared assistant contracts and domain logic that should not depend on Next.js.

- `packages/assistant-ui/`
  This already contains the chat drawer, composer, modes, preset chips, artifact previews, and other assistant-facing UI primitives under `packages/assistant-ui/src/chat/*`. This package should remain the home for presentation and client-side assistant interaction patterns.

- `apps/app/`
  This contains the app-specific route layer and repository implementations, including `/api/chat/*`, assistant settings integration, app-side caches, and storage-backed services. This layer should keep transport, config, credential resolution, and repository implementations that are specific to the Next.js app.

The approved design at [2026-03-20-radarboard-embedded-copilot-platform-design.md](/Users/thedaviddias/Projects/radarboard/docs/superpowers/specs/2026-03-20-radarboard-embedded-copilot-platform-design.md) defines a much larger program that eventually includes knowledge registry, live retrieval, evaluation, and knowledge health. This ExecPlan deliberately stops before those later slices.

Important terms in this plan:

- `AssistantRun`
  One assistant execution from input to output. It is the primary lineage object for later observability.

- `Artifact`
  A durable assistant output, especially for `Explore` and `Plan` results. In this slice, the key behavior is quiet auto-save and lineage capture.

- `VersionRefs`
  The prompt, preset, and skill versions associated with a run.

- deployment-level assistant disablement
  A hard module gate such as `ASSISTANT_ENABLED=false` that removes assistant UI surfaces, blocks assistant routes, and stops assistant jobs without deleting stored data.

## Plan of Work

Start by stabilizing the assistant as a module. Clarify which responsibilities live in `assistant-core`, `assistant-ui`, and `apps/app`, and wire a deployment-level module gate that can truly disable the assistant without leaving half-mounted UI, active routes, or background work behind. At the same time, establish or tighten the canonical contracts for runs, retrieval actions, artifacts, attachments, presets, traces, and repository interfaces.

Once the foundation is in place, improve the typing workflow without overwhelming the composer. The assistant should still feel like a calm prompt box by default, but it must support contextual attachments, skill and knowledge chips, prompt presets, assistant presets, and mode-aware behavior in a way that is inspectable rather than magical. This work should reuse and reorganize existing `assistant-ui` surfaces instead of adding parallel interaction systems.

After the input layer is improved, add the first durable output behavior: quiet background auto-save for substantial `Explore` and `Plan` runs, with lineage and trace capture. This includes `sourceRunId`-based idempotency, retrieval action records, citation linkage, and prompt/preset/skill version references. It is the minimum viable observability slice that later phases can build on.

Finish by validating compatibility and migrations. Existing conversations, routes, and legacy artifacts must continue to work when the assistant is enabled, and the module gate must produce a clean disabled state when it is off.

## Milestones

## Milestone 1: Assistant Foundation And Module Isolation

At the end of this milestone, the assistant should behave like an optional product module with clear package boundaries and canonical contracts. The module must be disableable at deployment level without broken routes or UI leftovers.

Implementation guidance:
- Audit and tighten the responsibility split between `packages/assistant-core`, `packages/assistant-ui`, and `apps/app`.
- Ensure `packages/assistant-core` owns the assistant contracts and repository interfaces needed for runs, artifacts, retrieval actions, attachments, presets, feedback, traces, and eval cases.
- Ensure app-specific implementations remain in `apps/app`.
- Add or complete the deployment flag behavior described in the design so the assistant can be disabled cleanly.
- Keep `/api/chat/*` route shapes stable when the module is enabled.
- Preserve existing assistant data rather than forcing a rewrite or destructive migration.

Acceptance:
- A deployment flag can disable assistant UI mount points, assistant routes, and assistant jobs cleanly.
- `assistant-core` contains the canonical contracts needed for the first slice.
- `assistant-ui` contains UI concerns rather than route or repository logic.
- Existing conversations and artifacts remain readable.

## Milestone 2: Typing Workflow And Composer Evolution

At the end of this milestone, the composer should support faster and more expressive assistant input without becoming cluttered or command-driven by default.

Implementation guidance:
- Update `packages/assistant-ui/src/chat/*` surfaces to support the intended composer posture: plain prompt box first, progressive power features second.
- Add or refine contextual attachments and visual chips for project scope, skills, knowledge sources, artifacts, and related attachments.
- Add or refine prompt preset chips for recurring workflows such as `Explore this idea` and `Turn this into a plan`.
- Add assistant preset behavior that binds model, mode, scope behavior, allowed retrieval domains, web policy, and default skills.
- Make mode behavior visible and meaningful across `Default`, `Explore`, `Plan`, `Review`, and `QA`.
- Preserve a unified insertion model rather than introducing multiple disconnected power-user systems.

Acceptance:
- The composer remains calm by default.
- Context attachments are visible, removable, and inspectable.
- Skill and preset attachment flows are usable from the composer.
- Mode selection and behavior are reflected clearly in the input experience.

## Milestone 3: Artifacts And Minimum Observability

At the end of this milestone, substantial `Explore` and `Plan` outputs should auto-save in the background, and the system should record the minimum run lineage needed for future observability and evaluation work.

Implementation guidance:
- Expand artifact save logic so substantial `Explore` and `Plan` outputs auto-save quietly.
- Use `sourceRunId` as the primary idempotency key for artifact upserts.
- Add or confirm the required lineage fields: `runId`, `sourceRunId`, `traceId`, citation references, and `VersionRefs`.
- Capture retrieval actions and citation metadata as part of run execution.
- Ensure failed runs do not block message delivery or create misleading artifacts.
- Preserve compatibility for older artifacts that lack new lineage fields.

Acceptance:
- `Explore` and `Plan` runs can auto-save substantial outputs without blocking chat delivery.
- Artifact saves are idempotent per run.
- Retrieval and citation metadata are recorded for the first observability slice.
- Legacy artifacts still render in compatibility mode.

## Milestone 4: Migration, Compatibility, And Trust Verification

At the end of this milestone, the assistant should remain compatible with existing data and route behavior while exposing enough visible state for the user to trust the new behavior.

Implementation guidance:
- Confirm existing assistant conversations remain readable after package or contract changes.
- Confirm `/api/chat/*` route behavior remains stable while enabled.
- Add or update compatibility migrations so lineage fields can be nullable backfills.
- Verify that auto-save, retrieval, and context-attachment actions are surfaced visibly enough that users can understand what happened.

Acceptance:
- Existing data is preserved.
- Existing assistant routes still work when the assistant is enabled.
- Legacy artifacts render safely.
- New retrieval and artifact behavior is visible enough to inspect, not silent and opaque.

## Milestone 5: Validation And Next Planning Boundary

At the end of this milestone, the touched packages and app code should pass the relevant validation commands and this plan should record what shipped and what remains for later phases.

Implementation guidance:
- Run lint, typecheck, and focused tests for `packages/assistant-core`, `packages/assistant-ui`, and app-side assistant routes and services.
- Update `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective`.
- Record the next planning boundary after Phase 3 so later work on knowledge registry, live retrieval, and full observability remains a separate ExecPlan slice.

Acceptance:
- The touched assistant packages and app paths pass validation.
- This ExecPlan reflects the actual implemented outcome.
- The next assistant planning slice is clearly defined.

## Concrete Steps

Run commands from the repository root unless another directory is specified.

For assistant-core checks:

    cd /Users/thedaviddias/Projects/radarboard/packages/assistant-core
    pnpm vitest run --reporter=verbose
    pnpm tsc --noEmit

For assistant-ui checks:

    cd /Users/thedaviddias/Projects/radarboard/packages/assistant-ui
    pnpm vitest run --reporter=verbose
    pnpm tsc --noEmit

For app-side assistant route and integration checks:

    cd /Users/thedaviddias/Projects/radarboard/apps/app
    pnpm vitest run --reporter=verbose app/api/chat lib
    pnpm tsc --noEmit

For focused lint and formatting checks:

    cd /Users/thedaviddias/Projects/radarboard
    pnpm --filter @radarboard/assistant-core exec biome check packages/assistant-core/src
    pnpm --filter @radarboard/assistant-ui exec biome check packages/assistant-ui/src
    pnpm --filter @radarboard/app exec biome check apps/app/app/api/chat apps/app/lib apps/app/components/settings/settings-integrations/components/assistant-access.tsx

If package names, test globs, or scripts differ in the current working tree, update this section before continuing so the next contributor does not need to rediscover the correct commands.

## Validation and Acceptance

Validation is complete only when all of the following are true:

- The assistant can be disabled at deployment level without broken chat UI, assistant routes, or assistant jobs.
- The assistant still works normally when enabled.
- Existing conversations remain readable.
- Existing artifacts remain readable, including compatibility behavior for legacy artifacts without new lineage fields.
- The composer supports the new typing workflow affordances without degrading into a cluttered command console.
- `Explore` and `Plan` can auto-save substantial outputs in the background.
- Runs record the minimum lineage and observability fields required by the design.
- Touched assistant packages and app-side code pass lint, typecheck, and relevant tests.

Manual verification should include:

    1. Run the app with the assistant enabled and verify the chat drawer, composer, and routes still work.
    2. Trigger an `Explore` or `Plan` flow and verify a substantial output saves in the background.
    3. Verify the saved artifact can be opened and linked back to its originating run.
    4. Confirm attached context, presets, or skills are visible in the composer UI.
    5. Restart with the assistant disabled and verify assistant routes return a disabled behavior such as `404` and assistant UI entry points do not mount.

## Idempotence and Recovery

This initiative touches package structure, route behavior, and persisted assistant data, so recovery planning matters.

Safe-to-repeat work:
- contract additions in `assistant-core`
- UI migrations inside `assistant-ui`
- additive lineage fields and nullable metadata backfills
- retrieval and artifact metadata capture as long as idempotency keys are respected

Risky areas:
- package-boundary moves that accidentally strand imports or route behavior
- deployment-flag behavior that hides UI but leaves active routes or background jobs
- artifact save changes that duplicate records or overwrite existing data incorrectly
- migrations that assume all historical artifacts already have new lineage fields

Recovery guidance:
- keep route shapes stable while internal implementations move;
- backfill new lineage fields as nullable and render legacy artifacts in compatibility mode;
- treat artifact upserts as idempotent by `sourceRunId`;
- verify the deployment flag in both enabled and disabled modes before broader rollout;
- migrate package boundaries incrementally rather than moving every assistant file in one step.

## Artifacts and Notes

Primary design source:
- [2026-03-20-radarboard-embedded-copilot-platform-design.md](/Users/thedaviddias/Projects/radarboard/docs/superpowers/specs/2026-03-20-radarboard-embedded-copilot-platform-design.md)

Relevant existing code areas:
- `packages/assistant-core/src/contracts.ts`
- `packages/assistant-core/src/runtime.ts`
- `packages/assistant-core/src/assistant-workflows.ts`
- `packages/assistant-core/src/attachments.ts`
- `packages/assistant-core/src/presets.ts`
- `packages/assistant-ui/src/chat/*`
- `packages/assistant-ui/src/settings/settings-ai.tsx`
- `apps/app/app/api/chat/*`
- `apps/app/lib/assistant-config.ts`
- `apps/app/lib/assistant-context-cache.ts`
- `apps/app/lib/memory-service.ts`
- `apps/app/lib/integration-artifacts.ts`

This plan intentionally stops before later program phases such as the knowledge registry, live retrieval expansion, full observability explorer, evaluation system, and knowledge health dashboard. Those remain approved design direction but require their own later ExecPlan slices.

## Interfaces and Dependencies

Internal dependencies:
- `packages/assistant-core` must define or own the assistant contracts for runs, retrieval, artifacts, presets, attachments, feedback, traces, and evals needed in Phases 1 through 3.
- `packages/assistant-ui` must own chat and assistant interaction surfaces rather than app-specific route logic.
- `apps/app` must continue to own route adapters, repository implementations, config, feature gating, and storage-backed services.

Important existing interfaces and concepts from the design:
- `AssistantRun`
- `RetrievalAction`
- `ArtifactRecord`
- `VersionRefs`
- repository contracts such as `AssistantRunRepository`, `ArtifactRepository`, `TraceRepository`, and `PresetRepository`
- deployment-level assistant flag behavior

External or cross-system dependencies:
- existing app settings and launch surfaces that expose assistant access
- existing artifact and conversation persistence
- assistant routes under `/api/chat/*`

Revision note: 2026-03-26. Created this feature-scale ExecPlan from the embedded copilot platform design to test `PLANS.md` against the largest planning category in the repository.
