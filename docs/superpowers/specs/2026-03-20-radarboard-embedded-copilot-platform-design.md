# Radarboard Embedded Copilot Platform Design

**Date:** 2026-03-20  
**Status:** Draft  
**Scope:** Dashboard-first assistant platform for typing workflow, research/planning, knowledge evolution, artifacts, and LLM observability

---

## Overview

Radarboard should not become a general-purpose assistant workspace in the Open WebUI mold. It should remain a solo-operator dashboard with a strong embedded copilot that understands projects, adapts to changing goals, uses live and stored evidence, and turns conversations into durable operating assets.

The design center is a daily workflow:

1. Capture intent quickly in the composer
2. Pull the right project context automatically
3. Research when local knowledge is insufficient
4. Produce a structured exploration or plan
5. Save useful outputs quietly in the background
6. Learn from changing goals, corrections, feedback, and outcomes
7. Expose enough observability to continuously improve prompts, retrieval, and recommendations

This is not a feature-parity effort with Open WebUI. The goal is to import the parts that materially improve Radarboard's project operating loop:

- stronger composer UX
- better skills and presets
- project-aware knowledge and retrieval
- guarded agentic web research
- durable artifacts and file storage
- Langfuse-like LLM observability and evaluation

---

## Product Boundary

### Product Position

Radarboard becomes a **dashboard-first embedded copilot platform**.

That means:

- the dashboard remains the home surface
- projects remain the primary organizing unit
- the assistant exists to improve project understanding, planning, recommendation quality, and execution follow-through
- assistant features should reinforce the operator workflow, not compete with it

### Core Product Rule

Every assistant capability should improve one or more of these loops:

- `understand`
- `plan`
- `recommend`
- `track`
- `adapt`

### Non-Goals

Radarboard should not, in this phase:

- become a generic multi-tenant AI workspace
- treat models, tools, and knowledge as the product's primary home surface
- chase broad Open WebUI workspace parity
- optimize for arbitrary AI use cases unrelated to projects and operations

---

## Approved Design Decisions

The following decisions were made during brainstorming and are considered part of the validated design:

- Product direction: **dashboard with embedded assistant**, not full assistant workspace
- Primary target workflows: **typing workflow** and **research/planning**
- Composer posture: **plain prompt box first**, with optional power features layered in progressively
- Retrieval posture: **agentic end-state with guardrails**
- Web search policy:
  - automatic in `Explore` and `Plan`
  - conditional in `Default` only for clearly time-sensitive or external questions
  - off by default in `Review` and `QA`
- Artifact save policy:
  - **automatic for `Explore` and `Plan`**
  - **quiet background save**, not a blocking modal
- Knowledge scope: **broader than Radarboard-native only**
- External source strategy: **hybrid indexed + live**

---

## Goals

### Product Goals

- Make the assistant meaningfully better at understanding current priorities, project state, and evolving intent
- Improve the quality of explorations, plans, and recommendations by combining project knowledge with live research
- Reduce friction in the composer so structured work feels as fast as ordinary chat
- Turn useful outputs into durable project assets automatically
- Make knowledge freshness, drift, and coverage visible
- Introduce LLM observability and evaluation tooling so the assistant can be improved continuously with evidence

### User Goals

For a solo operator, Radarboard should:

- remember what matters without requiring manual repetition
- adapt when goals change daily or weekly
- distinguish stale assumptions from live evidence
- show where a recommendation came from
- surface missing context and stale knowledge
- let the user iterate on skills, prompts, and presets without breaking flow

### System Goals

- preserve project scoping by default
- keep normal chat fast
- make more agentic modes inspectable, not magical
- support durable storage for files, plans, research traces, and diagrams
- support future voice mode without redesigning the assistant data model later
- isolate the assistant as a deployment-level module that can be disabled cleanly

---

## System Map

The assistant platform should be delivered as six connected sub-projects:

1. **Typing Workflow**
2. **Research + Planning Engine**
3. **Knowledge System**
4. **Adaptive Memory + Recommendation Layer**
5. **Artifact + File Storage**
6. **LLM Observability + Evaluation**

These are distinct responsibilities, but they should share one project-scoped model and one traceable run model.

---

## Module Isolation

### Design Intent

The assistant should be a first-class subsystem with a clean package boundary, but it should not be treated like a lightweight plugin.

Radarboard should support **deployment-level assistant disablement**, not per-project disablement.

This means the assistant should be isolated enough that a deployment can run with the assistant turned off without leaving half-wired UI, background jobs, or route behavior behind.

### Recommended Package Structure

#### `packages/assistant-core`

Owns assistant domain logic and interfaces:

- assistant modes
- workflows
- preset model
- retrieval policy
- artifact policy
- trace and run contracts
- knowledge contracts
- assistant configuration contracts

This package should not depend on Next.js or on app-local repository implementations.

#### `packages/assistant-ui`

Owns assistant presentation and client-side state:

- everything currently under `apps/app/components/chat/*`
- composer
- drawer
- messages
- search
- artifact views
- statusline
- session state and local UI helpers
- assistant-specific settings primitives that are reusable across apps

The current `components/chat` subtree should move here.

#### `apps/app` Integration Layer

Owns web-specific integration:

- `app/api/chat/*`
- repository and storage wiring
- provider credential resolution
- MCP and plugin bridging
- feature flag checks
- mounting into dashboard shell and settings modal
- Next.js transport specifics

### Move vs Stay

#### Move Out of `apps/app`

- `apps/app/components/chat/*` -> `packages/assistant-ui`
- assistant-only pure logic from `apps/app/lib/*` where it is not Next-specific

Examples likely to move:

- assistant workflow helpers
- retrieval policy helpers
- memory and assistant run domain logic
- future trace and preset helpers

#### Stay in `apps/app`

- `apps/app/app/api/chat/*`
- env/config handling
- repository implementations in `apps/app/db/*`
- web-only route handlers and transport code
- dashboard and settings mount points

### Deployment Flag

Add a deployment-level flag such as:

- `ASSISTANT_ENABLED=false`

When disabled:

- the chat drawer does not mount
- assistant actions do not appear in launcher surfaces
- assistant settings do not appear in the settings modal/sidebar
- `/api/chat/*` returns `404 Not Found`
- assistant background jobs do not run
- assistant package code should not be loaded on the client except for tiny stubs or gated imports
- existing assistant conversations, artifacts, and traces remain in storage unchanged
- existing assistant data is not surfaced in normal UI while the module is disabled
- re-enabling the module restores access to existing assistant data

### Why This Is Not A Normal Plugin

The assistant crosses too many boundaries to fit the current plugin model cleanly:

- it owns routes
- it owns storage
- it owns background work
- it influences settings, retrieval, and project knowledge
- it is not just one widget or overlay

So it should be treated as an **optional product module**, not as a standard plugin/addon.

### Integration Principles

- package the assistant by responsibility, not by file count
- depend on interfaces from packages, not app-local concrete implementations
- keep dashboard core capable of rendering without assistant code paths
- use lazy imports where possible so disabling the assistant actually reduces client weight

---

## Canonical Interfaces

The implementation plan should not have to rediscover the assistant domain model. These are the required shared entities and contracts.

### V1 Status Enums

```ts
type AssistantRunStatus = "started" | "completed" | "needs_input" | "failed" | "cancelled";
type RetrievalActionStatus = "started" | "completed" | "skipped" | "needs_input" | "failed" | "cancelled";
type ArtifactStatus = "draft" | "completed" | "needs_input" | "failed";
```

### Shared Entities

#### `AssistantRun`

Represents one assistant execution from input through output.

Required fields:

- `id`
- `projectSlug?`
- `conversationId?`
- `messageId?`
- `mode`
- `presetId`
- `modelId`
- `status`: `started | completed | needs_input | failed | cancelled`
- `startedAt`
- `endedAt?`
- `sourceType`: `user_message | regenerate | background_task`
- `versionRefs`

`projectSlug` is nullable only for aggregate or global runs. Project scope remains the default. When `projectSlug` is null, automatic retrieval must stay limited to global-native context plus explicit manual attachments.

`conversationId` and `messageId` are nullable only for `background_task` runs such as Daily Operator Brief. Chat-originated runs must always carry both IDs.

#### `RetrievalAction`

Represents one evidence-acquisition step inside an assistant run.

Required fields:

- `id`
- `runId`
- `kind`: `memory | artifact | indexed_knowledge | live_source | web_search | web_read`
- `query`
- `targetSourceIds`
- `status`: `started | completed | skipped | needs_input | failed | cancelled`
- `latencyMs`
- `fallbackUsed`
- `errorCode`
- `errorMessage`

#### `KnowledgeSource`

Represents a retrievable project knowledge item or live source descriptor.

Required fields:

- `id`
- `projectSlug?`
- `sourceType`: `core_context | note | memory | artifact | document | github_file | mcp_source | web_page`
- `retrievalMode`: `indexed | live`
- `trustLevel`: `high | medium | low`
- `freshnessClass`: `fresh | aging | stale`
- `syncStatus`: `ready | pending | failed | disabled`
- `openUrl`
- `lastSyncedAt`
- `retrievalEligibility`

#### `ArtifactRecord`

Represents a durable assistant output.

Required fields:

- `id`
- `projectSlug?`
- `sourceRunId`
- `type`
- `mode`
- `title`
- `summary`
- `status`: `draft | completed | needs_input | failed`
- `dedupeKey`
- `version`
- `body`
- `contentType`: `markdown | html | mermaid`
- `evidenceSourceIds`
- `citationIds`
- `partialReason?`
- `traceId`
- `createdAt`

#### `RecommendationFeedback`

Represents structured user feedback attached to a run or artifact.

Required fields:

- `id`
- `projectSlug?`
- `runId`
- `recommendationId?`
- `artifactId?`
- `rating`: `useful | wrong | stale | shallow | too_generic | overfit`
- `comment`
- `createdAt`

#### `RecommendationRecord`

Represents one stored recommendation generated by the assistant.

Required fields:

- `id`
- `projectSlug?`
- `runId`
- `artifactId?`
- `text`
- `evidenceSourceIds`
- `confidence`
- `createdAt`

#### `VersionRefs`

Represents the prompt, preset, and skill versions that shaped a run.

Required fields:

- `promptVersionId`
- `presetVersionId`
- `skillVersionIds`

#### `AssistantPreset`

Represents a reusable assistant operating profile.

Required fields:

- `id`
- `name`
- `modelId`
- `defaultMode`
- `projectScopeBehavior`: `required | preferred | none`
- `allowedRetrievalDomains`: Array<`native` | `indexed` | `live` | `web`>
- `webSearchPolicy`: `off` | `conditional` | `allowed`
- `defaultSkillIds`
- `starterPromptIds`

#### `Skill`

Represents a builtin or custom skill available to the assistant.

Required fields:

- `id`
- `name`
- `description`
- `instructions`
- `kind`: `builtin | custom`

#### `AssistantAttachment`

Represents a scoped attachment that affects one message, thread, preset, or mode.

Required fields:

- `id`
- `ownerType`: `message | thread | preset | mode`
- `ownerId`
- `targetType`: `skill | knowledge | artifact | note`
- `targetId`
- `required`
- `createdAt`

### Repository Contracts

The first implementation plan should assume these interfaces exist in `assistant-core` and are implemented in `apps/app`:

- `AssistantRunRepository`
- `KnowledgeRepository`
- `ArtifactRepository`
- `RecommendationRepository`
- `FeedbackRepository`
- `SkillRepository`
- `AttachmentRepository`
- `PresetRepository`
- `TraceRepository`
- `EvalRepository`

V1 method signatures:

```ts
interface AssistantRunRepository {
  createStarted(run: AssistantRun): Promise<void>; // idempotent by run.id
  complete(runId: string, patch: { status: "completed" | "needs_input"; endedAt: string }): Promise<void>;
  fail(runId: string, patch: { status: "failed" | "cancelled"; endedAt: string; errorCode?: string; errorMessage?: string }): Promise<void>;
  appendRetrieval(action: RetrievalAction): Promise<void>; // idempotent by action.id
}

interface ArtifactRepository {
  upsertPrimaryFromRun(input: {
    sourceRunId: string;
    projectSlug: string | null;
    mode: string;
    title: string;
    summary: string;
    status: ArtifactStatus;
    dedupeKey: string;
    body: string;
    contentType: "markdown" | "html" | "mermaid";
    evidenceSourceIds: string[];
    citationIds: string[];
    partialReason?: string;
    traceId: string;
  }): Promise<{ artifactId: string }>; // idempotent by sourceRunId
  addRelation(input: {
    artifactId: string;
    relation: "supersedes" | "derived_from" | "cited_by";
    targetArtifactId: string;
  }): Promise<void>;
}

interface KnowledgeRepository {
  listEligibleSources(input: {
    projectSlug: string | null;
    mode: string;
  }): Promise<KnowledgeSource[]>;
  recordSyncResult(input: {
    sourceId: string;
    syncStatus: "ready" | "pending" | "failed" | "disabled";
    lastSyncedAt?: string;
    errorCode?: string;
  }): Promise<void>;
}

interface RecommendationRepository {
  record(input: {
    id: string;
    projectSlug: string | null;
    runId: string;
    artifactId?: string;
    text: string;
    evidenceSourceIds: string[];
    confidence: "high" | "medium" | "low";
    createdAt: string;
  }): Promise<void>;
}

interface FeedbackRepository {
  record(input: RecommendationFeedback): Promise<void>; // idempotent by feedback.id
}

interface SkillRepository {
  listAvailable(): Promise<Skill[]>;
}

interface AttachmentRepository {
  listForOwner(input: {
    ownerType: "message" | "thread" | "preset" | "mode";
    ownerId: string;
  }): Promise<AssistantAttachment[]>;
}

interface PresetRepository {
  save(input: AssistantPreset & { versionId: string; createdAt: string }): Promise<void>; // idempotent by preset.id + versionId
  list(): Promise<AssistantPreset[]>;
}

interface TraceRepository {
  createRoot(input: { traceId: string; runId: string; rootSpanId: string; startedAt: string }): Promise<void>; // idempotent by traceId
  appendSpan(input: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    name: string;
    status: "started" | "completed" | "failed";
    startedAt: string;
    endedAt?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>; // idempotent by spanId
  recordCitation(input: {
    id: string;
    runId: string;
    artifactId?: string;
    sourceId: string;
    label: string;
    openUrl?: string;
    sourceClass: string;
  }): Promise<void>; // idempotent by citation.id
}

interface EvalRepository {
  saveCase(input: {
    id: string;
    runId: string;
    artifactId?: string;
    promptVersionId: string;
    createdAt: string;
  }): Promise<void>;
}
```

Ownership rules:

- `assistant-core` defines interfaces and domain types
- `assistant-ui` emits user actions and consumes read models
- `apps/app` implements repositories and route adapters

Idempotency rules:

- runs are idempotent by `run.id`
- retrieval actions are idempotent by `action.id`
- primary artifact saves are idempotent by `sourceRunId`
- feedback is idempotent by `feedback.id`

### Live Connector Contract

V1 live connectors must implement a shared boundary instead of bespoke behavior.

```ts
interface LiveConnector {
  id: "github" | "mcp" | "url";
  canSearch: boolean;
  search?(input: { projectSlug: string | null; query: string; limit: number }): Promise<Array<{ id: string; title: string }>>;
  fetch(input: { sourceId?: string; url?: string; timeoutMs: number }): Promise<{
    content: string;
    openUrl?: string;
    citationLabel: string;
    retrievedAt: string;
  }>;
  refreshAuth?(): Promise<"ok" | "unavailable">;
}
```

Behavior requirements:

- all connectors must honor timeout budgets
- all connectors must return citation metadata
- auth refresh is optional, but failure must degrade cleanly
- open-link behavior comes from `openUrl`

### Emitted Events

Required emitted events:

- `assistant.run.started`
- `assistant.run.completed`
- `assistant.run.failed`
- `retrieval.action.started`
- `retrieval.action.completed`
- `retrieval.action.skipped`
- `retrieval.action.needs_input`
- `retrieval.action.failed`
- `retrieval.action.cancelled`
- `artifact.save.started`
- `artifact.save.completed`
- `artifact.save.failed`
- `knowledge.sync.started`
- `knowledge.sync.completed`
- `knowledge.sync.failed`
- `assistant.feedback.recorded`

These events are the basis for the trace explorer, knowledge health, and evaluation pipeline.

Representative payloads:

```ts
type AssistantEvent =
  | { type: "assistant.run.started"; runId: string; projectSlug: string | null; mode: string; at: string }
  | { type: "assistant.run.completed"; runId: string; status: "completed" | "needs_input"; artifactId?: string; at: string }
  | { type: "assistant.run.failed"; runId: string; status: "failed" | "cancelled"; errorCode?: string; errorMessage?: string; at: string }
  | { type: "retrieval.action.completed"; runId: string; actionId: string; status: "completed" | "skipped" | "needs_input"; at: string }
  | { type: "retrieval.action.failed"; runId: string; actionId: string; status: "failed" | "cancelled"; errorCode?: string; at: string }
  | { type: "artifact.save.failed"; runId: string; sourceRunId: string; errorCode?: string; at: string };
```

### Canonical Lifecycle Rules

| Object | Start | Success | Recoverable stop | Terminal failure | User stop / disable |
|---|---|---|---|---|---|
| `AssistantRun` | `started` | `completed` | `needs_input` | `failed` | `cancelled` |
| `RetrievalAction` | `started` | `completed` | `needs_input` or `skipped` | `failed` | `cancelled` |
| Artifact save | `started` event only | `completed` artifact | `needs_input` artifact | save failure event | save cancelled before start |

Lifecycle rules:

- `createStarted` runs without `endedAt`
- terminal states always set `endedAt`
- user stop marks the run `cancelled`
- user stop marks any active retrieval actions `cancelled`
- if `ASSISTANT_ENABLED` flips while a run is already executing, the in-flight run is allowed to finish, but new runs are rejected and queued background work created after the flag change is not started
- queued background work that has not started when the module is disabled is marked `cancelled`

---

## Typing Workflow

### Design Intent

The composer should optimize for:

`fast thought capture -> scoped retrieval -> structured output`

It should feel calm by default and powerful when invoked.

### Composer Posture

- The default surface is a simple prompt box, not a command console
- Scope and power features appear progressively
- The user should not need to learn slash commands to get value
- The system should still support power-user insertion and attachment patterns

### Core Composer Capabilities

#### Ghost-Text Autocomplete

Add project-aware autocomplete similar in spirit to Open WebUI's autocomplete feature, but scoped to Radarboard workflows.

Behavior:

- powered by a small fast model
- debounced while typing
- suggests completions, follow-up phrasing, or planning scaffolds
- accepted with `Tab`
- ignored by continued typing

Use cases:

- expanding a partial prompt
- suggesting a stronger planning request
- continuing a structured template such as "turn this into a plan with..."

#### Contextual Mentions and Commands

Support the following inline affordances:

- `@project`
  - scopes the conversation to a project
  - pins visible project context
- `$skill`
  - attaches a skill to the message, thread, or preset
- `#knowledge`
  - explicitly attaches a knowledge source such as a document, research pack, synced source, or URL-backed knowledge entry
- `/preset`, `/artifact`, `/note`, `/doc`, `/goal`, `/memory`
  - structured insertion and quick-start actions

These should not be treated as separate power-user systems. They should all participate in one unified composer interaction model.

### Prompt Presets

Add one-click starter prompts optimized for recurring operator workflows.

Initial preset examples:

- `Explore this idea`
- `Turn this into a plan`
- `Review this approach`
- `Compare project priorities`
- `Summarize what changed this week`
- `Find what is stale in this project`

These should appear as lightweight starter chips in the composer for eligible presets.

### Context Chips

When context is attached automatically or manually, the composer should show inspectable chips above the input.

Chip examples:

- active project
- skill attached
- note attached
- artifact attached
- knowledge source attached
- web page attached

Chips should be removable and inspectable.

### Skill UX

Skills need to move from the current inline-card editing model to a searchable workspace flow.

Required capabilities:

- unified list of built-in and custom skills
- search and filtering
- quick attach from composer
- edit in a focused side panel or modal
- clone
- import/export
- display usage state:
  - available
  - attached to current message
  - attached to current thread
  - attached to preset
- show override status for built-ins
- show last edited and usage references

### Assistant Presets

Radarboard should add **assistant presets** instead of copying Open WebUI's full model builder.

A preset should bind:

- base model
- default mode
- project scope behavior
- attached skills
- allowed retrieval domains
- web search policy
- starter prompts

Initial preset examples:

- `Project Advisor`
- `Planner`
- `Research Analyst`
- `Launch Reviewer`
- `Daily Operator Brief`

Preset precedence rules:

1. manual attachments on the current message
2. thread-level attachments
3. preset defaults
4. mode defaults
5. system defaults

Prompt presets do not override assistant presets. They seed user intent; assistant presets define runtime behavior defaults.

### Mode Behavior

- `Default`
  - low-friction chat
  - light retrieval
  - minimal automation
- `Explore`
  - richer retrieval
  - stronger autocomplete
  - web search allowed
- `Plan`
  - evidence-focused retrieval
  - structured output
  - quiet artifact save
- `Review`
  - adversarial evaluation
  - no ambient web search by default
- `QA`
  - verification-focused
  - browser/app/tool evidence first

### Typing Workflow Principles

- do not overload the composer with static controls
- do not require command syntax for normal use
- do not interrupt flow with save dialogs
- do surface agentic actions and attached context visibly

---

## Research + Planning Engine

### Design Intent

Radarboard should use a **project-scoped retrieval and reasoning pipeline**, not a generic RAG widget.

The assistant should combine:

- Radarboard-native project state
- prior assistant outputs
- curated project knowledge
- selected live sources
- guarded web research

This document is a **program-level design**. The next planning artifact should cover **Phases 1 through 3 only**:

- Assistant Foundation
- Typing Workflow
- Artifacts + Minimum Observability

Later phases stay in this design as program direction, but should not be part of the first implementation plan.

### Retrieval Source Classes

#### 1. Native Structured Context

Highest-priority context:

- project stage
- goals
- priorities
- metrics
- recent anomalies
- recent shipping
- connected integrations

#### 2. Native Unstructured Context

- notes
- memories
- saved artifacts
- previous plans
- prior reviews and QA results
- relevant chat history

#### 3. Indexed Project Knowledge

- uploaded documents
- markdown files
- PDFs
- briefs
- specs
- reports
- selected synced external sources worth repeated retrieval

#### 4. Live Project-Linked Sources

- live MCP-backed sources
- current GitHub content
- current issues
- one-off URLs
- volatile sources where freshness matters more than indexing

#### 5. Web Research

Only used when local/project evidence is insufficient or when the question is time-sensitive or clearly external.

### Retrieval Policy by Mode

#### Default

- automatically loads lightweight native context
- uses knowledge and web only when clearly necessary

#### Explore

- can autonomously search native context, indexed knowledge, live project sources, and guarded web
- optimized for hypothesis formation and option discovery

#### Plan

- same source access as Explore
- more evidence-focused and reusable
- should prefer stable project knowledge before open web

#### Review

- prefers internal artifacts, code/project evidence, and existing context
- web usually disabled unless explicitly needed

#### QA

- prefers browser/app evidence, run history, prior artifacts, and tool outputs
- web disabled by default

### Agentic Retrieval Policy

Radarboard should support **agentic retrieval, not silent retrieval**.

That means:

- retrieval can happen automatically
- the UI must expose what happened
- retrieval traces must be inspectable
- users should be able to see what was auto-attached, what was queried, and what was cited

Visible run statuses should include examples like:

- `Checking project context`
- `Searching recent artifacts`
- `Searching project knowledge`
- `Fetching live source`
- `Searching web`
- `Reading external page`

### Automatic Web Search Policy

Recommended policy:

- `Explore` and `Plan`: automatic web search allowed by default
- `Default`: web search only when the prompt is clearly time-sensitive, external, or under-informed by local context
- `Review` and `QA`: off by default

This preserves fast normal chat while allowing deeper research when it matters.

### Initial Supported Live Connectors For V1

To keep the first implementation plan bounded, V1 live retrieval should support only:

- Radarboard-native project context and existing assistant data
- uploaded knowledge documents
- GitHub repository files and docs via existing GitHub integration credentials
- configured MCP sources already connected in Radarboard settings
- explicit external URLs fetched during research runs

V1 does not include automatic sync from arbitrary SaaS documentation systems.

### Structured Outputs

`Explore` and `Plan` should produce structured outputs that are easy to store, cite, diff, and reuse.

Each such run should be able to output:

- title
- summary
- evidence list
- recommendation
- next step
- reusable artifact body

### Artifact Save Policy

Radarboard should treat `Explore` and `Plan` outputs as workflow assets, not disposable responses.

Policy:

- auto-save substantial Explore and Plan outputs
- save in the background
- show a visible but non-blocking acknowledgement
- allow later rename/pin/convert/edit from artifact surfaces

Normal chat should not auto-save every answer as an artifact.

### Research Trace Capture

Every research-heavy run should preserve:

- retrieved knowledge sources
- live fetches
- web queries
- URLs visited
- citations used in final output

This trace should be linkable from the saved artifact.

### Failure Handling And Fallbacks

Retrieval and research need explicit unhappy-path behavior.

| Failure | Behavior | UI / Trace effect |
|---|---|---|
| Missing credentials for a live source | skip that source and continue fallback order | show `Source unavailable`; record `skipped` retrieval action |
| Expired OAuth token | attempt one refresh when supported, then degrade to unavailable | trace refresh attempt and final status |
| Rate limit | stop retrying within the same run and continue to the next source class | show `Rate limited`; run may end as `needs_input` |
| Timeout | cancel that retrieval action at a per-source timeout budget and continue fallback order | show `Timed out`; keep run responsive |
| MCP source failure | mark source unavailable for this run, do not abort the entire run unless it was explicitly attached and required | show partial evidence state |
| Web fetch error | skip failed URL and continue with remaining sources | cite only successful sources |
| Contradictory sources | rank by explicit attachment, then source-class trust, then freshness; if conflict remains material, surface it explicitly and do not silently merge | show `Conflicting evidence` trace row |
| No useful local evidence | in Explore/Plan, fall through to guarded web research; in Default, answer with lower confidence or ask for direction | mark low-confidence or partial evidence state |

Fallback order:

1. native structured context
2. native unstructured context
3. indexed project knowledge
4. live project-linked sources
5. web research

Conflict ranking rule:

1. explicitly attached source
2. higher source-class trust
3. fresher source within the same class
4. if still tied and materially conflicting, surface the conflict and avoid silent merge

---

## Knowledge System

### Design Intent

Radarboard needs a real knowledge layer, not just memory rows and notes.

The correct model is a **Project Knowledge Registry**.

### Registry Contents

Each project should have:

- `core context`
- `memory`
- `artifacts`
- `documents`
- `external knowledge sources`
- `research traces`

### Indexed vs Live Strategy

External knowledge should follow a hybrid strategy.

#### Index When

- the source is reused often
- the source is foundational to planning
- it changes slowly enough to justify indexing
- cross-source retrieval is valuable

Examples:

- product briefs
- specs
- process docs
- curated external references
- selected repo docs

#### Fetch Live When

- freshness matters more than speed
- the source is narrow and directly addressable
- it is too volatile or too large to index economically

Examples:

- latest issues
- current dashboards
- changelog pages
- one-off pages
- volatile MCP outputs

### Knowledge Entry Metadata

Every knowledge source should track:

- owning project
- source type
- indexed vs live
- freshness
- last sync
- retrieval eligibility by mode
- trust level
- origin URL or open target
- extraction status
- indexing status

### Knowledge Evolution

Radarboard should include a dedicated way to inspect how knowledge is evolving over time.

This should be a first-class product surface, not buried debug state.

#### Knowledge Health View

Per project and global views should answer:

- what does the assistant currently know?
- what changed recently?
- what is stale?
- what is contradictory?
- what is missing?
- which sources are actually helping recommendations and plans?

#### Required Signals

V1 derivation rules:

- `references directly` means either:
  - explicit linkage metadata between source and goal/priority, or
  - normalized exact title match against active goal/priority titles in artifact summaries, note titles, or indexed chunk metadata
- `fresh knowledge item` means a source with `freshnessClass = fresh`
- `topical cluster` means:
  - goal id when available
  - otherwise priority id when available
  - otherwise explicit source tag
  - otherwise normalized query stem + source type
- `normalized-field extraction` in V1 is deterministic and limited to:
  - project stage
  - goal status
  - target date
  - active focus
  - operator preference keys

V1 does not depend on open-ended fuzzy extraction for knowledge health scoring.

##### Coverage

- how much of the project's active goals and priorities are reflected in knowledge
- which projects have weak knowledge density

Initial rule:

- source of truth for active goals and priorities is the project context store
- an active goal or priority is considered `covered` if at least one fresh knowledge item references it directly in the last 30 days
- initial coverage score:
  - `covered active goals + covered active priorities`
  - divided by `total active goals + total active priorities`
- thresholds:
  - `healthy >= 0.75`
  - `warning >= 0.50 and < 0.75`
  - `poor < 0.50`

##### Freshness

- stale docs
- stale synced sources
- stale goals
- stale memories
- stale artifacts

Initial rule:

- goals/priorities: stale if last updated > 30 days and still active
- memories: stale if last referenced or updated > 30 days
- artifacts: stale if latest successful Explore/Plan artifact > 21 days old for an active project
- indexed docs: stale if source freshness window exceeded or sync failed
- live connectors: freshness comes from last successful access and source-specific TTL

Freshness source of truth is the knowledge registry plus project context timestamps.

##### Drift

- places where the current project direction no longer matches existing notes, prompts, or artifacts

Initial rule:

- a project is flagged for drift when active goals or priorities changed after the latest successful plan artifact or project summary artifact
- drift severity increases when the last plan/research artifact predates the latest goal update by more than 7 days
- prompts and presets are drift-sensitive only when attached by default to that project or preset

##### Contradictions

- conflicting memories
- conflicting artifacts
- docs that disagree with newer project direction

Initial rule:

- contradictions are detected only for normalized fields in V1:
  - active focus
  - goal status
  - target date
  - project stage
  - explicit operator preferences
- if two high-trust sources disagree on the same normalized field and are both still active, mark contradiction
- contradictions do not auto-resolve; they require explicit user review or a newer higher-trust source

Source of truth hierarchy:

1. project context
2. explicit operator feedback or corrected memory
3. latest successful artifact
4. synced or uploaded docs
5. live or web sources

##### Usefulness

- which sources are actually retrieved
- which sources are cited in successful plans and recommendations

Initial rule:

- usefulness is measured over the last 30 completed Explore/Plan runs per project
- a source is `high-usefulness` when it is both retrieved and cited in at least 20 percent of relevant runs after a minimum of 5 retrievals
- a source is `low-usefulness` when it is retrieved at least 10 times and cited in fewer than 10 percent of those runs

##### Gaps

- repeated cases where the assistant had to go to the web because local project knowledge was insufficient

Initial rule:

- a gap is recorded when a run falls through to web research after exhausting local retrieval tiers and the final answer cites web sources as primary evidence
- a project gets a `knowledge gap` warning when this happens more than 3 times in 14 days for the same topical cluster

This becomes the dashboard for the assistant's evolving understanding.

---

## Adaptive Memory + Recommendation Layer

This is a distinct sub-project that shares the knowledge registry, but it is not identical to the knowledge registry.

### Adaptive Memory

Radarboard should not only store facts. It should track:

- recurring constraints
- preferences
- strategic corrections
- decisions
- goal changes
- project focus shifts

Memory should be:

- selective
- editable
- project-scoped by default where possible
- auditable

V1 source-of-truth rules:

- explicit project context is the source of truth for goals, priorities, and stage
- memory is the source of truth only for operator preferences, constraints, and durable facts not modeled elsewhere
- artifacts are the source of truth for prior assistant outputs
- live integrations remain the source of truth for current metrics

### Recommendation Layer

Recommendations should improve over time by incorporating:

- updated goals
- repeated operator feedback
- project outcomes
- prior successful plans
- stale or failed recommendation patterns

The system should prefer adaptive recommendation quality over raw answer variety.

#### Recommendation Record

V1 recommendation storage should use the canonical `RecommendationRecord`.

#### Triggers

V1 recommendation generation happens only when:

- an Explore or Plan run completes successfully
- a Daily Operator Brief preset runs
- the user explicitly asks for recommendations in Default mode

#### Delivery Slice

V1 does not require a standalone recommendations product surface.

Recommendations are delivered through:

- Explore / Plan output blocks
- Daily Operator Brief output
- feedback captured against `RecommendationRecord`

#### Storage Boundaries

- every generated recommendation must have a `RecommendationRecord`
- recommendation feedback always targets a `runId`
- `artifactId` is optional and present only when the recommendation is linked to a saved artifact

This keeps the adaptive layer scoped enough for the first implementation plan.

---

## Artifact + File Storage

### Design Intent

The current artifact model is a strong seed, but Radarboard needs a broader asset system.

Artifacts should become durable project assets with attachments, lineage, and versioning.

### Storage Layers

Radarboard should distinguish four storage layers:

#### 1. Operational Database

Stores:

- projects
- settings
- conversations
- memories
- artifact metadata
- traces
- retrieval logs
- sync jobs
- feedback
- evaluation data

#### 2. Object / Blob Storage

Stores:

- uploaded docs
- generated exports
- screenshots
- diagrams
- future audio
- HTML assets
- large attachments

#### 3. Vector / Index Storage

Stores:

- embeddings
- chunk metadata
- retrieval index
- chunk freshness and source linkage

#### 4. Cache / Transient Execution State

Stores:

- API cache
- web fetch cache
- retrieval cache
- autocomplete cache
- sync coordination state
- queue state

### Recommended Primary Backend Direction

Radarboard should keep multi-provider abstractions, but bias product design toward one strong default path for the knowledge-heavy assistant.

Recommended primary direction:

- **Supabase / Postgres** for long-term production path
- **SQLite** for local/dev and single-user fallback

Reasons:

- operational data, traces, and evaluation data fit well in Postgres
- pgvector keeps retrieval near operational data if desired
- Supabase Storage provides a plausible object-storage path
- current provider parity is incomplete for more advanced repos, so product design should not assume every backend will advance equally quickly

### Artifact Model Expansion

Artifacts should expand from text-only workflow outputs into a general asset system.

#### Artifact Record

Core metadata:

- id
- project
- type
- mode
- title
- summary
- status
- created by
- source run id

#### Artifact Version

Stores:

- version history
- changes over time
- diffable revisions
- linkage to prompt/preset/skill versions

#### Artifact Attachment

Stores links to:

- files
- images
- diagrams
- exports
- captured web pages

#### Artifact Relation

Supports:

- derived from
- supersedes
- cited by
- plan for
- review of
- QA for

### Artifact Types

Initial supported types should include:

- plan
- research brief
- decision log
- review report
- QA report
- generated document
- diagram
- note snapshot
- preset draft
- eval case

### File Model

Files should be first-class entities with:

- file id
- project scope
- source type: uploaded, synced, generated, imported URL, MCP-derived
- storage location
- mime type
- checksum
- extraction status
- indexing status
- last indexed at
- source freshness
- sync state
- open URL where relevant

### Excalidraw MCP

If an Excalidraw MCP server is connected, the assistant should be able to generate diagrams through the MCP tool path.

However, Radarboard should not rely on the MCP server for long-term ownership.

Recommended behavior:

- call Excalidraw MCP to generate diagram output
- ingest the resulting data into Radarboard's own file/artifact layer
- preserve:
  - canonical `.excalidraw` JSON when available
  - rendered preview such as SVG or PNG
  - metadata linking the diagram to the source artifact, run, and project

This preserves ownership, previewability, and future editability.

### Auto-Save Decision Rules

`Explore` and `Plan` outputs need precise background-save behavior.

#### Save Threshold

Auto-save when all of the following are true:

- mode is `Explore` or `Plan`
- run status is `completed` or `needs_input`, not `failed`
- output contains either:
  - a top-level title or structured headings, or
  - at least one actionable recommendation / next step block, or
  - at least 400 non-whitespace characters after normalization

Do not auto-save:

- short conversational clarifications
- follow-up answers that only refine a previous artifact without enough new material
- failed runs

#### Idempotency And Deduping

- one primary artifact is created per successful `AssistantRun`
- dedupe key is `sourceRunId`
- retries for the same run must upsert the same artifact record, not create duplicates
- a regeneration creates a new run and therefore a new artifact candidate
- if the new artifact clearly supersedes a recent artifact in the same conversation and mode, record a `supersedes` relation rather than overwriting

#### Naming

- default title comes from the top heading when present
- otherwise derive title from the first meaningful line
- if title conflicts with an existing artifact in the same project and day, append an incrementing suffix

#### Save Failure Behavior

- save failure must never block message delivery
- UI shows non-blocking `Artifact save failed` state with retry action
- trace event records the failure
- manual save retry remains available from the message or artifact surface

#### Partial Save Behavior

- if a run finishes with partial evidence but still produced a structured output, save as `needs_input` rather than discarding it
- saved artifact should preserve the partial-evidence reason in metadata

---

## LLM Observability + Evaluation

### Design Intent

Radarboard needs Langfuse-like observability, but grounded in Radarboard's product model.

This should not just be generic token logging. It should let the operator improve:

- prompts
- presets
- skills
- retrieval policy
- recommendation quality
- knowledge quality

### Trace Model

Each meaningful assistant run should capture:

- user input
- mode
- selected model
- selected preset
- active skills
- project scope
- prompt version
- retrieval actions
- tool calls
- web search actions
- output
- token usage
- latency
- saved artifact linkage
- downstream feedback

Minimum lineage fields required from the first assistant foundation phase:

- `runId`
- `sourceRunId` on saved artifacts
- `VersionRefs`
- citation references
- retrieval action linkage

### Span Model

Traces should include spans such as:

- `run`
- `prompt_build`
- `memory_lookup`
- `artifact_lookup`
- `knowledge_search`
- `live_fetch`
- `web_search`
- `web_read`
- `tool_call`
- `response_generation`
- `artifact_save`

### Retrieval Inspection

The system must show:

- what sources were retrieved
- ranking or score information when available
- whether the source was indexed or fetched live
- whether the source was cited in the final answer

### Prompt / Preset / Skill Versioning

Every run should link to:

- prompt version
- preset version
- skill versions used

This allows comparison across changes and prevents invisible regressions.

### Feedback Capture

Users should be able to mark recommendations as:

- useful
- wrong
- stale
- shallow
- too generic
- overfit

This should be captured as structured feedback linked to the originating run and artifact.

### Outcome Tracking

For plans and recommendations, the system should support lightweight outcome states:

- adopted
- revised
- abandoned
- unresolved

This helps distinguish "interesting answer" from "actually useful operating guidance".

### Evaluation System

Radarboard should support creation of eval cases from real work:

- save a representative run as an eval case
- re-run it against newer prompt/preset/retrieval versions
- compare output quality, evidence quality, and recommendation usefulness

This is the mechanism for continuous assistant improvement.

### Knowledge-Quality Feedback Loop

Observability should feed back into the Knowledge Health system.

Examples:

- a source retrieved often but never cited may be low value
- repeated web fallbacks suggest missing local knowledge
- repeated corrections suggest stale memory or poor prompt framing
- successful plans that consistently cite certain knowledge types can influence future ranking

### User-Facing Trust

Because Radarboard will allow agentic retrieval, the user must be able to inspect:

- why a recommendation was made
- what evidence was used
- what the assistant searched
- what was stored automatically

This is a trust requirement, not a nice-to-have.

---

## Infrastructure and Performance Foundation

### Redis

Redis is useful, but not as the primary answer to dashboard performance.

Recommended Redis use cases:

- background job queue
- rate limiting
- shared retrieval/session caches across instances
- autocomplete throttling and shared caching
- sync job coordination
- invalidation fan-out
- trace/event buffering

Redis should not be treated as:

- the primary artifact store
- the primary knowledge store
- the main dashboard speed strategy

### Browser-Native Features

Near-term dashboard speed wins should come more from browser-native features than from backend coordination.

Recommended additions:

- `IndexedDB`
  - local cache for knowledge manifests, retrieved docs, and autocomplete context
- `Service Worker`
  - shell caching and selective API caching
- `BroadcastChannel`
  - cross-tab state sync
- stronger virtualization and content visibility
  - for large traces, artifact lists, and source lists
- streaming retrieval status UI
  - show research steps incrementally instead of only at completion

### Performance Principle

Use the browser to make repeat interactions feel instant. Use backend caches and queues to coordinate expensive work and freshness.

---

## Delivery Plan

This should ship incrementally, not as a single rewrite.

### Phase 1: Assistant Foundation

- deployment-level module isolation
- `assistant-core` and `assistant-ui` package boundaries
- canonical interfaces and repository contracts
- `AssistantRun` foundation
- minimum lineage fields and version references

### Phase 2: Typing Workflow

- ghost-text autocomplete
- unified composer insertion model
- `$skill`
- prompt presets
- improved skills workspace UX
- assistant presets

### Phase 3: Artifacts + Minimum Observability

- quiet auto-save for Explore and Plan
- auto-save threshold and dedupe behavior
- artifact lineage via `sourceRunId`
- retrieval action capture
- citation linkage
- prompt/preset/skill version linkage

### Phase 4: Knowledge Registry

- uploaded docs
- project-native knowledge surfaces
- project knowledge registry UI
- knowledge freshness and sync state

### Phase 5: Live Retrieval + Web Research

- hybrid indexed/live retrieval policy
- V1 live connectors
- guarded agentic web search in Explore and Plan
- research trace capture
- failure and fallback handling

### Phase 6: Full Observability + Evaluation

- span explorer
- retrieval inspection UI
- structured feedback capture
- evaluation cases
- recommendation outcome tracking
- knowledge health dashboard

### Phase 7: Hybrid Sync Expansion

- selected external source indexing beyond V1 connectors
- richer sync jobs
- broader freshness and drift controls

### Phase 8: Voice Mode Follow-Up Spec

- voice mode is explicitly a follow-up spec and not part of the first implementation plan

### Next Planning Boundary

The next implementation-planning artifact should cover only:

- Phase 1: Assistant Foundation
- Phase 2: Typing Workflow
- Phase 3: Artifacts + Minimum Observability

Everything after Phase 3 remains part of the approved program direction but should be planned in later slices.

---

## Migration And Compatibility

The first implementation plan must preserve existing assistant data and route behavior wherever possible.

### Package Migration

- moving `apps/app/components/chat/*` into `packages/assistant-ui` is an internal package migration, not a user-visible feature break
- route paths remain unchanged in the first planning slice
- dashboard launcher and settings entry points may change implementation, but not product intent

### Data Migration

- existing conversations remain readable after the package split
- existing artifact records remain readable
- new lineage fields such as `sourceRunId`, `traceId`, and `citationIds` are added as nullable backfill columns in the first migration
- old artifact records without lineage continue to render as legacy artifacts

### Compatibility Guarantees For Phases 1-3

- `/api/chat/*` route shape remains stable when the module is enabled
- existing conversations do not need content rewrites
- existing artifact bodies remain valid
- legacy artifacts without new metadata are displayed in compatibility mode rather than dropped

---

## Risks

### Product Drift

If too many assistant-workspace features become first-class navigation, Radarboard may lose dashboard primacy.

Mitigation:

- keep project/dashboard surfaces primary
- route assistant features back to projects and workflows

### Retrieval Noise

Overly aggressive agentic retrieval can make answers slower and noisier.

Mitigation:

- mode-aware retrieval policy
- visible retrieval traces
- feedback-driven tuning

### Storage Complexity

Documents, vectors, traces, and artifacts can create backend sprawl.

Mitigation:

- separate storage responsibilities clearly
- bias toward one recommended production backend path

### Observability Without Actionability

If traces are captured but not used to improve prompts and retrieval, the system becomes expensive instrumentation.

Mitigation:

- link traces directly to feedback, evals, and prompt/preset revisions

---

## Success Criteria

The design is successful if Radarboard can:

- make the composer materially faster and more expressive without becoming cluttered
- produce stronger Explore and Plan outputs with clearly visible evidence
- auto-save reusable workflow outputs quietly and reliably
- maintain a project-scoped knowledge model that evolves over time
- show what the assistant knows, what is stale, and what is missing
- trace assistant runs deeply enough to improve prompts, retrieval, and recommendations with evidence
- improve recommendation quality over time instead of merely storing more chats
- disable the entire assistant cleanly at deployment level without leaving broken UI, routes, or jobs

---

## Summary

Radarboard should become a dashboard-centered copilot that:

- helps the operator think faster
- retrieves better evidence
- turns useful outputs into durable assets
- learns from goal drift and feedback
- exposes enough observability to be improved systematically

The highest-leverage path is not broad Open WebUI parity. It is a focused platform around typing workflow, research/planning, knowledge evolution, artifact durability, and LLM observability.
