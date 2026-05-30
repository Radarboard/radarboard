# Knowledge Health Dashboard Design

Date: 2026-03-20
Status: Draft
Owner: Codex

## Summary

Radarboard needs a product-facing operating surface for improving how the assistant understands the user, adapts to changing project goals, and produces better recommendations over time.

The first slice is a global-first `Knowledge Health` dashboard that answers three questions in one place:

- what the system currently knows
- whether that knowledge is helping real assistant runs
- what needs updating, pruning, or inspection

This is not a debug-only tool and not a settings-only view. It is a first-class dashboard surface for continuously improving assistant quality.

## Goals

- Make persistent assistant knowledge inspectable across the whole workspace.
- Show whether knowledge-backed runs produce better outcomes than runs without knowledge.
- Surface stale, low-signal, or underused knowledge that should be updated or removed.
- Let the user drill from summary metrics into concrete memories, artifacts, traces, evidence refs, and recommendations.
- Reuse the observability and artifact lineage work already in place instead of inventing a new storage system.

## Non-Goals

- Full knowledge graph modeling.
- Bulk editing or bulk cleanup workflows.
- Automatic pruning or automatic re-ranking of memories.
- Goal-drift detection or weekly “what the system learned” narratives in V1.
- Exact per-memory attribution when current trace metadata only supports aggregate memory recall.
- Connector contribution analytics unless connector identity is explicitly captured in joinable metadata.
- True recommendation outcome scoring beyond the recommendation direction already present in artifacts and trace metadata.

## Product Shape

The first version is a dedicated `Knowledge Health` page in the dashboard app.

The page opens in a global view, then drills into projects and individual knowledge items.

High-level structure:

1. Header
- Title, description, and top-line health counters.

2. Search and filters
- Search term
- Project
- Item type
- Fresh vs stale
- Positive vs negative feedback association
- Evidence-backed vs no-evidence

3. Three health sections
- `Knowledge Inventory`
- `Knowledge Effectiveness`
- `Needs Attention`

4. Project breakdown
- Compact health cards for each project
- Click to open project-filtered view

5. Unified item list
- Memories and artifacts in one list
- Sort/filterable
- Opens detail drawer or filtered drill-through

6. Detail view
- Provenance
- Last used date
- Use counts
- Feedback association
- Linked traces, artifacts, and evidence refs

The page should feel like an operating console, not a generic analytics dashboard and not a raw audit log.

## Why Global First

The page should default to a global view because knowledge quality issues usually emerge across the system first:

- stale memories accumulate across projects
- some connectors never contribute useful context
- certain knowledge patterns may correlate with weak recommendations
- assistant activity may be high in some projects without durable knowledge being formed

Fixes usually happen at project level, but the detection surface should start globally.

## Core Lenses

### 1. Knowledge Inventory

Purpose: show what durable knowledge exists and where it lives.

Metrics:

- total persistent memories
- total assistant artifacts
- items used in last 7 days
- items used in last 30 days
- project distribution
- source distribution by type

Item types in V1:

- `memory`
- `artifact`

Future types:

- `note`
- `knowledge`
- `web evidence`
- `connector-derived source clusters`

### 2. Knowledge Effectiveness

Purpose: show whether knowledge-backed runs are actually improving outcomes.

For V1, a `knowledge-backed` run means a run where at least one of the following is true:

- one or more assistant artifacts were attached
- one or more dependency artifacts were present
- memory recall count was greater than zero

V1 does not count skills or generic notes as knowledge-backed for headline metrics because the first item model only covers memories and artifacts.

Metrics:

- runs with attached or recalled knowledge
- positive vs negative feedback for knowledge-backed runs
- artifact saves produced from knowledge-backed runs
- recommended next-mode distribution for knowledge-backed runs
- most frequently reused knowledge items
- top evidence-linked artifacts

### 3. Needs Attention

Purpose: show what should be inspected, refreshed, or removed.

Metrics:

- stale memories not referenced recently
- memories repeatedly associated with negative feedback
- artifacts with no downstream reuse
- recommendations produced without evidence refs
- projects with high assistant activity but low knowledge usage

Deferred from V1:

- connectors configured but not contributing context

## V1 Information Model

V1 does not need a new assistant knowledge database. It should derive a unified model from existing tables and events.

Primary storage already available:

- `llm_memory`
- `llm_artifacts`
- `llm_traces`
- `debug_events`

Existing derivation infrastructure already available:

- trace insight aggregation
- context lineage metadata
- evidence refs on artifacts
- feedback records on traces

Unified V1 knowledge item shape:

```ts
type KnowledgeHealthItem = {
  id: string;
  type: "memory" | "artifact";
  projectSlug: string | null;
  title: string;
  summary: string | null;
  createdAt: string;
  updatedAt?: string | null;
  lastUsedAt: string | null;
  useCount: number | null;
  positiveFeedbackCount: number | null;
  negativeFeedbackCount: number | null;
  artifactInfluenceCount: number | null;
  recommendationInfluenceCount: number | null;
  evidenceRefCount: number;
  stale: boolean;
  attributionQuality: "explicit" | "inferred";
};
```

Unscoped items (`projectSlug = null`) belong to a synthetic `Global` bucket.

Rules:

- they appear in the global summary
- they appear in a dedicated `Global` project card or filter option
- they are not counted inside concrete project cards in V1

## Attribution Rules

The UI must be honest about attribution quality.

Artifact attribution:

- generally explicit
- can be tied to artifact IDs, evidence refs, and saved artifact lineage

Memory attribution:

- initially partial
- derived from runs where memory recall occurred
- not always attributable to a specific memory key
- current metadata can include memory keys, but keys are not guaranteed to map uniquely to a single persisted memory row across scopes

V1 rule:

- if the system can tie a metric to a concrete item, label it explicit
- if the metric is inferred from a run-level recall signal, label it inferred

Additional V1 rule for memories:

- per-memory `lastUsedAt`, `useCount`, linked traces, and feedback counts are only populated when a recalled key maps unambiguously to one persisted memory item
- otherwise, the memory remains listable and editable, but usage-related fields are null or zero and marked as inferred/unknown

The user should be able to distinguish hard lineage from approximated lineage.

## API Design

### `GET /api/assistant/knowledge-health/summary`

Returns the global rollup for the page.

Includes:

- total memory count
- total artifact count
- recently used counts
- stale counts
- knowledge-backed run counts
- positive/negative feedback summary
- top reused items
- top stale items
- project breakdown

### `GET /api/assistant/knowledge-health/items`

Returns a unified, paginated, filterable list of knowledge items.

Filters:

- `project`
- `type`
- `stale`
- `feedback`
- `evidence`
- `query`

### `GET /api/assistant/knowledge-health/projects/:slug`

Returns a project-specific rollup for the selected project.

Includes:

- per-project counts
- project-specific stale items
- project-specific most reused items
- knowledge-backed run effectiveness summary

### `GET /api/assistant/knowledge-health/items/:id`

Returns the detail drawer payload for a single memory or artifact.

Includes:

- canonical item record
- attribution quality
- linked traces
- linked artifacts
- linked evidence refs
- feedback summary
- supported direct actions

This endpoint is required in V1 so the detail drawer can stay specific without forcing the client to overfetch and re-aggregate large event sets.

## Backend Derivation Strategy

V1 should add a thin aggregation layer on top of existing repositories.

New backend pieces:

- knowledge health aggregation service in the web integration layer
- summary route
- item list route
- project detail route

V1 repository boundary:

- use existing `LlmRepository` methods:
  - `listMemory`
  - `listArtifacts`
  - `listTraces`
- use existing debug-event querying via `queryDebugEvents`
- perform aggregation in the web integration layer over a recent bounded window
- do not require repository interface extensions for the first slice

If V1 proves too slow on real data, follow-up work can add repository-level aggregate queries. That is explicitly out of scope for the first implementation slice.

The aggregation logic should combine:

- memories from `llm_memory`
- artifacts from `llm_artifacts`
- traces from `llm_traces`
- debug event metadata and trace insights from existing observability paths

### Derived usage

Usage should be derived from:

- attached artifact usage
- attached note usage where present
- attached skill usage where relevant to supporting metrics
- memory recall metadata on runs
- artifact save events and downstream artifact dependency use
- feedback attached to traces

All V1 usage and freshness metrics are retention-bounded by the currently available debug/tracing window.

### Derived staleness

Initial staleness rule:

- memory or artifact with no recent usage inside the retained event window

Default V1 thresholds:

- stale warning: no usage in the last 30 days
- no separate critical bucket in V1 unless retained debug history is explicitly configured beyond 30 days and the implementation adds a corresponding capability check

Important limitation:

- because `debug_events` retention defaults to 30 days today, V1 must not claim 90-day precision unless retention has actually been extended
- where history is truncated by retention, the UI should label freshness as `based on retained history`

## UI Design

The page should follow Radarboard’s catalog/admin patterns rather than debug-table patterns.

### Layout

- Header with title, description, and counters
- Search/filter row
- 3-column health grid
- Project cards grid
- Unified knowledge list
- Detail drawer

### Visual language

- compact operational cards
- strong badge language for status and attribution quality
- clickable chips for filters and drill-down
- restrained use of charts

Charts are useful only where trend matters:

- knowledge usage over time
- positive vs negative feedback over time
- recent artifact reuse trend

V1 should not become chart-heavy.

### Detail drawer content

For each selected item:

- source type
- project
- creation/update timestamps
- last used timestamp
- use count
- positive/negative feedback counts
- evidence ref count
- linked artifacts
- linked traces
- linked recommendation outcomes
- linked recommended next modes
- delete action for memories
- open artifact action for artifacts
- jump to trace/events actions

When the item has inferred or unknown attribution, the drawer should show that clearly and avoid presenting null metrics as strong facts.

## Navigation

The page should be accessible from the main dashboard/admin navigation as a first-class assistant quality surface.

It should not live inside:

- Debug
- Assistant Settings

Reason:

- settings is for configuration
- debug is for low-level inspection
- knowledge health is an operational improvement surface

## First Implementation Slice

The first implementation slice should ship:

- `Knowledge Health` page
- summary API
- unified item list API
- global counters
- project breakdown
- stale memories and artifacts
- top reused items
- feedback split for knowledge-backed vs non-knowledge-backed runs
- recommended next-mode distribution for knowledge-backed runs
- drill-through to artifacts, traces, and events
- memory delete from the detail view
- explicit `Global` bucket handling for unscoped items
- retention-bounded freshness labels

## Deferred Work

Defer the following until after V1:

- weekly “what the system learned” timeline
- automatic cleanup suggestions
- goal-priority drift detection
- exact per-memory attribution if not available in current metadata
- note and external knowledge collections as first-class item types
- richer recommendation outcome scoring
- automated interventions or quality automation
- connector contribution analytics unless connector identity is added to observability metadata

## Technical Fit With Current Architecture

This work fits the current assistant architecture well.

The package split already in place supports it:

- `assistant-core`
  - trace insight derivation
  - evidence and context lineage helpers
- `assistant-ui`
  - can host reusable assistant-facing display components if needed later
- `apps/app`
  - API routes
  - repository access
  - page-level integration

V1 knowledge health aggregation should stay in the web integration layer first, because it depends on repositories and route wiring. If the aggregation contracts stabilize, the reusable parts can be pulled into `assistant-core` later.

## Risks

### 1. False precision

If the UI overstates attribution quality, it will mislead product decisions.

Mitigation:

- label inferred vs explicit attribution
- avoid invented scores

### 2. Dashboard without actionability

If the page only shows counts, it becomes decorative.

Mitigation:

- every major metric must drill into real records
- detail views must expose direct next actions

### 3. Overbuilding V1

A perfect knowledge system is much larger than this slice.

Mitigation:

- keep V1 to inventory, effectiveness, and needs-attention surfaces
- defer automation, goal adaptation narratives, and richer knowledge types

## Recommendation

Ship `Knowledge Health` as a global-first operating dashboard backed by existing assistant memory, artifact, trace, and debug-event infrastructure.

This gives Radarboard an immediate feedback loop for improving assistant quality while preserving room to expand later into:

- goal adaptation views
- richer knowledge collections
- retrieval quality analysis
- recommendation quality tuning
