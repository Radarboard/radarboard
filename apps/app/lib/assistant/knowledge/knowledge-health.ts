import {
  type AssistantTraceInsight,
  buildTraceInsight,
} from "@radarboard/assistant-core/trace-insights";
import { API_ROUTES } from "@radarboard/types/api-routes";
import type {
  KnowledgeHealthAction,
  KnowledgeHealthArtifactRecord,
  KnowledgeHealthItem,
  KnowledgeHealthItemDetail,
  KnowledgeHealthItemsResponse,
  KnowledgeHealthLinkedArtifact,
  KnowledgeHealthMemoryRecord,
  KnowledgeHealthNextModeCount,
  KnowledgeHealthProjectResponse,
  KnowledgeHealthProjectSummary,
  KnowledgeHealthRunFeedbackSummary,
  KnowledgeHealthSummary,
  KnowledgeHealthSummaryResponse,
  KnowledgeHealthTraceLink,
} from "@radarboard/types/assistant";
import type {
  AssistantArtifactRow,
  AssistantEvidenceRef,
  LlmMemoryRow,
  LlmRepository,
  LlmTraceRow,
} from "@radarboard/types/database";
import { queryDebugEvents } from "@/lib/debug-events";

const STALE_THRESHOLD_DAYS = 30;
const DEBUG_EVENT_LIMIT = 5_000;
const REPO_ROW_LIMIT = 5_000;

type KnowledgeHealthDebugEvent = Awaited<ReturnType<typeof queryDebugEvents>>[number];

interface KnowledgeHealthSnapshot {
  memories: LlmMemoryRow[];
  artifacts: AssistantArtifactRow[];
  traces: LlmTraceRow[];
  events: KnowledgeHealthDebugEvent[];
  traceInsights: Array<LlmTraceRow & { insight: AssistantTraceInsight }>;
  traceMeta: Map<string, KnowledgeHealthTraceMeta>;
  memoryByKey: Map<string, LlmMemoryRow[]>;
  artifactById: Map<string, AssistantArtifactRow>;
  memoryUsage: Map<string, Set<string>>;
  artifactUsage: Map<string, KnowledgeHealthArtifactUsage>;
  eventWindow: {
    startAt: string | null;
    endAt: string | null;
    retainedDays: number;
  };
}

interface KnowledgeHealthTraceMeta {
  trace: LlmTraceRow & { insight: AssistantTraceInsight };
  projectSlug: string | null;
  knowledgeBacked: boolean;
  memoryKeys: string[];
  attachedArtifactIds: string[];
  dependencyArtifactIds: string[];
  savedArtifactIds: string[];
  evidenceRefs: AssistantEvidenceRef[];
  nextMode: string | null;
  feedbackRating: number | null;
}

interface KnowledgeHealthArtifactUsage {
  attachmentTraceIds: Set<string>;
  dependencyTraceIds: Set<string>;
  savedTraceIds: Set<string>;
  linkedTraceIds: Set<string>;
  evidenceRefs: AssistantEvidenceRef[];
}

interface KnowledgeHealthResolvedItem extends KnowledgeHealthItem {
  traceIds: string[];
  evidenceRefs: AssistantEvidenceRef[];
  item: LlmMemoryRow | AssistantArtifactRow;
}

type KnowledgeHealthProjectKey = string | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => typeof value === "string" && value.length > 0)
    ),
  ];
}

function uniqueEvidenceRefs(refs: AssistantEvidenceRef[]): AssistantEvidenceRef[] {
  return [
    ...new Map(
      refs.map((ref) => [`${ref.kind}:${ref.label}:${ref.url ?? ""}`, ref] as const)
    ).values(),
  ];
}

function parseMemoryKeys(value: unknown): string[] {
  if (!isRecord(value)) return [];
  const keys = value.keys;
  if (!Array.isArray(keys)) return [];
  return uniqueStrings(keys as Array<string | null | undefined>);
}

function getProjectLabel(projectSlug: string | null): string {
  return projectSlug ?? "Global";
}

function normalizeProjectFilter(
  project: string | null | undefined
): KnowledgeHealthProjectKey | undefined {
  if (project == null) return undefined;
  if (project === "" || project === "all") return undefined;
  if (project === "global") return null;
  return project;
}

function parseItemIdentifier(
  identifier: string
): { type: "memory" | "artifact"; id: string } | null {
  if (identifier.startsWith("memory:"))
    return { type: "memory", id: identifier.slice("memory:".length) };
  if (identifier.startsWith("artifact:"))
    return { type: "artifact", id: identifier.slice("artifact:".length) };
  return null;
}

function toItemId(type: "memory" | "artifact", id: string): string {
  return `${type}:${id}`;
}

function isStale(lastUsedAt: string | null, createdAt: string): boolean {
  const reference = lastUsedAt ?? createdAt;
  const referenceTime = Date.parse(reference);
  if (Number.isNaN(referenceTime)) return false;
  const ageMs = Date.now() - referenceTime;
  return ageMs >= STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
}

function emptyRunFeedbackSummary(): KnowledgeHealthRunFeedbackSummary {
  return {
    total: { positive: 0, negative: 0 },
    knowledgeBacked: { positive: 0, negative: 0 },
    nonKnowledgeBacked: { positive: 0, negative: 0 },
  };
}

function incrementFeedback(
  summary: KnowledgeHealthRunFeedbackSummary,
  knowledgeBacked: boolean,
  rating: number | null
): void {
  if (rating === 1) {
    summary.total.positive += 1;
    if (knowledgeBacked) summary.knowledgeBacked.positive += 1;
    else summary.nonKnowledgeBacked.positive += 1;
  } else if (rating === -1) {
    summary.total.negative += 1;
    if (knowledgeBacked) summary.knowledgeBacked.negative += 1;
    else summary.nonKnowledgeBacked.negative += 1;
  }
}

function buildNextModeBuckets(
  traceMeta: KnowledgeHealthTraceMeta[],
  projectSlug: string | null | undefined = undefined
): KnowledgeHealthNextModeCount[] {
  const buckets = new Map<string | null, KnowledgeHealthNextModeCount>();
  for (const meta of traceMeta) {
    if (projectSlug !== undefined && meta.projectSlug !== projectSlug) continue;
    if (!meta.knowledgeBacked) continue;
    const key = meta.nextMode ?? null;
    const current =
      buckets.get(key) ??
      ({
        nextMode: key,
        count: 0,
        knowledgeBackedCount: 0,
      } satisfies KnowledgeHealthNextModeCount);
    current.count += 1;
    current.knowledgeBackedCount += 1;
    buckets.set(key, current);
  }
  return [...buckets.values()].sort(
    (a, b) => b.count - a.count || `${a.nextMode ?? ""}`.localeCompare(`${b.nextMode ?? ""}`)
  );
}

function groupEventsByTraceId(
  events: KnowledgeHealthDebugEvent[]
): Map<string, KnowledgeHealthDebugEvent[]> {
  const map = new Map<string, KnowledgeHealthDebugEvent[]>();
  for (const event of events) {
    if (!event.traceId) continue;
    const current = map.get(event.traceId) ?? [];
    current.push(event);
    map.set(event.traceId, current);
  }
  return map;
}

function computeEventWindow(events: KnowledgeHealthDebugEvent[]): {
  newestEventAt: string | null;
  oldestEventAt: string | null;
} {
  let newestEventAt: string | null = null;
  let oldestEventAt: string | null = null;
  for (const event of events) {
    if (!newestEventAt || event.occurredAt > newestEventAt) newestEventAt = event.occurredAt;
    if (!oldestEventAt || event.occurredAt < oldestEventAt) oldestEventAt = event.occurredAt;
  }
  return { newestEventAt, oldestEventAt };
}

function extractMemoryKeysFromEvents(relatedEvents: KnowledgeHealthDebugEvent[]): string[] {
  return uniqueStrings(
    relatedEvents.flatMap((event) => {
      if (event.eventType !== "chat.context.loaded" && event.eventType !== "chat.memory.recalled") {
        return [];
      }
      return parseMemoryKeys(event.metadata?.memory);
    })
  );
}

function extractSavedArtifactIds(relatedEvents: KnowledgeHealthDebugEvent[]): string[] {
  return uniqueStrings(
    relatedEvents.flatMap((event) => {
      if (event.eventType !== "chat.artifact.saved") return [];
      const artifact = isRecord(event.metadata?.artifact) ? event.metadata.artifact : null;
      return artifact && typeof artifact.id === "string" ? [artifact.id] : [];
    })
  );
}

function buildTraceMetaEntry(
  trace: LlmTraceRow & { insight: AssistantTraceInsight },
  relatedEvents: KnowledgeHealthDebugEvent[]
): KnowledgeHealthTraceMeta {
  const projectSlug =
    relatedEvents
      .map((event) => event.projectSlug)
      .find((value) => value !== null && value !== undefined) ?? null;
  const memoryKeys = extractMemoryKeysFromEvents(relatedEvents);
  const savedArtifactIds = extractSavedArtifactIds(relatedEvents);
  const attachedArtifactIds = trace.insight.attachedArtifacts.map((item) => item.id);
  const dependencyArtifactIds = trace.insight.dependencyArtifacts.map((item) => item.id);
  const knowledgeBacked =
    trace.insight.memoryCount > 0 ||
    attachedArtifactIds.length > 0 ||
    dependencyArtifactIds.length > 0;

  return {
    trace,
    projectSlug,
    knowledgeBacked,
    memoryKeys,
    attachedArtifactIds,
    dependencyArtifactIds,
    savedArtifactIds,
    evidenceRefs: trace.insight.evidenceRefs,
    nextMode: trace.insight.nextMode,
    feedbackRating: trace.rating ?? trace.insight.feedbackRating ?? null,
  };
}

function linkArtifactUsage(
  usage: KnowledgeHealthArtifactUsage,
  traceId: string,
  bucket: "attachmentTraceIds" | "dependencyTraceIds" | "savedTraceIds",
  evidenceRefs: KnowledgeHealthTraceMeta["evidenceRefs"]
) {
  usage[bucket].add(traceId);
  usage.linkedTraceIds.add(traceId);
  usage.evidenceRefs.push(...evidenceRefs);
}

function linkArtifactIds(
  ids: string[],
  bucket: "attachmentTraceIds" | "dependencyTraceIds" | "savedTraceIds",
  traceId: string,
  evidenceRefs: KnowledgeHealthTraceMeta["evidenceRefs"],
  artifactUsage: Map<string, KnowledgeHealthArtifactUsage>
) {
  for (const id of ids) {
    const usage = artifactUsage.get(id);
    if (usage) linkArtifactUsage(usage, traceId, bucket, evidenceRefs);
  }
}

function resolveUniqueMemory(
  memoryByKey: Map<string, LlmMemoryRow[]>,
  key: string
): LlmMemoryRow | null {
  const candidates = memoryByKey.get(key) ?? [];
  return candidates.length === 1 ? (candidates[0] ?? null) : null;
}

function computeUsageMaps(
  traceMeta: Map<string, KnowledgeHealthTraceMeta>,
  memoryByKey: Map<string, LlmMemoryRow[]>,
  memoryUsage: Map<string, Set<string>>,
  artifactUsage: Map<string, KnowledgeHealthArtifactUsage>
) {
  for (const meta of traceMeta.values()) {
    const traceId = meta.trace.id;

    for (const key of meta.memoryKeys) {
      const memory = resolveUniqueMemory(memoryByKey, key);
      if (memory) memoryUsage.get(memory.id)?.add(traceId);
    }

    linkArtifactIds(
      meta.attachedArtifactIds,
      "attachmentTraceIds",
      traceId,
      meta.evidenceRefs,
      artifactUsage
    );
    linkArtifactIds(
      meta.dependencyArtifactIds,
      "dependencyTraceIds",
      traceId,
      meta.evidenceRefs,
      artifactUsage
    );
    linkArtifactIds(
      meta.savedArtifactIds,
      "savedTraceIds",
      traceId,
      meta.evidenceRefs,
      artifactUsage
    );
  }
}

async function loadSnapshot(repo: LlmRepository): Promise<KnowledgeHealthSnapshot> {
  const retainedAfter = new Date(
    Date.now() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const [memories, artifacts, traces, events] = await Promise.all([
    repo.listMemory(),
    repo.listArtifacts({ limit: REPO_ROW_LIMIT }),
    repo.listTraces(REPO_ROW_LIMIT),
    queryDebugEvents({ after: retainedAfter, limit: DEBUG_EVENT_LIMIT }),
  ]);

  const traceInsights = buildTraceInsight(traces, events);
  const eventsByTraceId = groupEventsByTraceId(events);
  const { newestEventAt, oldestEventAt } = computeEventWindow(events);

  const traceMeta = new Map<string, KnowledgeHealthTraceMeta>();
  for (const trace of traceInsights) {
    const relatedEvents = eventsByTraceId.get(trace.id) ?? [];
    traceMeta.set(trace.id, buildTraceMetaEntry(trace, relatedEvents));
  }

  const memoryByKey = new Map<string, LlmMemoryRow[]>();
  for (const memory of memories) {
    const rows = memoryByKey.get(memory.key) ?? [];
    rows.push(memory);
    memoryByKey.set(memory.key, rows);
  }

  const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact] as const));

  const memoryUsage = new Map<string, Set<string>>();
  const artifactUsage = new Map<string, KnowledgeHealthArtifactUsage>();

  for (const memory of memories) {
    memoryUsage.set(memory.id, new Set());
  }
  for (const artifact of artifacts) {
    artifactUsage.set(artifact.id, {
      attachmentTraceIds: new Set(),
      dependencyTraceIds: new Set(),
      savedTraceIds: new Set(),
      linkedTraceIds: new Set(),
      evidenceRefs: [],
    });
  }

  computeUsageMaps(traceMeta, memoryByKey, memoryUsage, artifactUsage);

  return {
    memories,
    artifacts,
    traces,
    events,
    traceInsights,
    traceMeta,
    memoryByKey,
    artifactById,
    memoryUsage,
    artifactUsage,
    eventWindow: {
      startAt: oldestEventAt,
      endAt: newestEventAt,
      retainedDays: STALE_THRESHOLD_DAYS,
    },
  };
}

function buildMemoryItem(
  memory: LlmMemoryRow,
  snapshot: KnowledgeHealthSnapshot
): KnowledgeHealthResolvedItem {
  const candidates = snapshot.memoryByKey.get(memory.key) ?? [];
  const isUnique = candidates.length === 1;
  const traceIds = [...(snapshot.memoryUsage.get(memory.id) ?? new Set())];
  const traceMeta = traceIds
    .map((traceId) => snapshot.traceMeta.get(traceId))
    .filter((meta): meta is KnowledgeHealthTraceMeta => Boolean(meta));
  const positiveFeedbackCount = traceMeta.filter((meta) => meta.feedbackRating === 1).length;
  const negativeFeedbackCount = traceMeta.filter((meta) => meta.feedbackRating === -1).length;
  const lastUsedAt =
    traceMeta.length > 0
      ? (traceMeta
          .map((meta) => meta.trace.createdAt)
          .sort()
          .at(-1) ?? null)
      : null;
  const evidenceRefCount = uniqueEvidenceRefs(
    traceMeta.flatMap((meta) => meta.evidenceRefs)
  ).length;

  const useCount = isUnique ? traceIds.length : null;
  const attributionQuality = isUnique ? "explicit" : "inferred";
  const stale = isUnique && useCount !== null ? isStale(lastUsedAt, memory.createdAt) : false;

  return {
    id: toItemId("memory", memory.id),
    sourceId: memory.id,
    type: "memory",
    projectSlug: memory.projectSlug,
    title: memory.key,
    summary: memory.value,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt ?? null,
    lastUsedAt,
    useCount,
    positiveFeedbackCount: isUnique ? positiveFeedbackCount : 0,
    negativeFeedbackCount: isUnique ? negativeFeedbackCount : 0,
    artifactInfluenceCount: null,
    recommendationInfluenceCount: null,
    evidenceRefCount: isUnique ? evidenceRefCount : 0,
    stale,
    attributionQuality,
    traceIds,
    evidenceRefs: uniqueEvidenceRefs(traceMeta.flatMap((meta) => meta.evidenceRefs)),
    item: memory,
  };
}

function buildArtifactItem(
  artifact: AssistantArtifactRow,
  snapshot: KnowledgeHealthSnapshot
): KnowledgeHealthResolvedItem {
  const usage = snapshot.artifactUsage.get(artifact.id) ?? {
    attachmentTraceIds: new Set<string>(),
    dependencyTraceIds: new Set<string>(),
    savedTraceIds: new Set<string>(),
    linkedTraceIds: new Set<string>(),
    evidenceRefs: [],
  };
  const linkedTraces = [...usage.linkedTraceIds]
    .map((traceId) => snapshot.traceMeta.get(traceId))
    .filter((meta): meta is KnowledgeHealthTraceMeta => Boolean(meta));
  const positiveFeedbackCount = linkedTraces.filter((meta) => meta.feedbackRating === 1).length;
  const negativeFeedbackCount = linkedTraces.filter((meta) => meta.feedbackRating === -1).length;
  const attachmentTraceIds = [...usage.attachmentTraceIds];
  const dependencyTraceIds = [...usage.dependencyTraceIds];
  const reuseTraceIds = [...new Set([...attachmentTraceIds, ...dependencyTraceIds])];
  const lastUsedAt =
    reuseTraceIds.length > 0
      ? (reuseTraceIds
          .map((traceId) => snapshot.traceMeta.get(traceId)?.trace.createdAt ?? null)
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1) ?? null)
      : null;
  const evidenceRefCount = uniqueEvidenceRefs([
    ...artifact.evidenceRefs,
    ...usage.evidenceRefs,
  ]).length;

  return {
    id: toItemId("artifact", artifact.id),
    sourceId: artifact.id,
    type: "artifact",
    projectSlug: artifact.projectSlug,
    title: artifact.title,
    summary: artifact.summary,
    createdAt: artifact.createdAt,
    updatedAt: null,
    lastUsedAt,
    useCount: reuseTraceIds.length,
    positiveFeedbackCount,
    negativeFeedbackCount,
    artifactInfluenceCount: attachmentTraceIds.length,
    recommendationInfluenceCount: dependencyTraceIds.length,
    evidenceRefCount,
    stale: isStale(lastUsedAt, artifact.createdAt),
    attributionQuality: "explicit",
    traceIds: [...usage.linkedTraceIds],
    evidenceRefs: uniqueEvidenceRefs([...artifact.evidenceRefs, ...usage.evidenceRefs]),
    item: artifact,
  };
}

function buildResolvedItems(snapshot: KnowledgeHealthSnapshot): KnowledgeHealthResolvedItem[] {
  return [
    ...snapshot.memories.map((memory) => buildMemoryItem(memory, snapshot)),
    ...snapshot.artifacts.map((artifact) => buildArtifactItem(artifact, snapshot)),
  ];
}

function summarizeItemsForProject(
  items: KnowledgeHealthResolvedItem[],
  snapshot: KnowledgeHealthSnapshot,
  projectSlug: string | null
): KnowledgeHealthProjectSummary {
  const projectItems = items.filter((item) => item.projectSlug === projectSlug);
  const traceMetas = [...snapshot.traceMeta.values()].filter(
    (meta) => meta.projectSlug === projectSlug
  );
  const summary = emptyRunFeedbackSummary();

  for (const meta of traceMetas) {
    incrementFeedback(summary, meta.knowledgeBacked, meta.feedbackRating);
  }

  const knowledgeBackedRunCount = traceMetas.filter((meta) => meta.knowledgeBacked).length;
  const recentlyUsedCount = projectItems.filter((item) => item.lastUsedAt && !item.stale).length;
  const staleCount = projectItems.filter((item) => item.stale).length;
  const itemCount = projectItems.length;
  const memoryCount = projectItems.filter((item) => item.type === "memory").length;
  const artifactCount = projectItems.filter((item) => item.type === "artifact").length;
  const topReusedItems = [...projectItems]
    .filter((item) => (item.useCount ?? 0) > 0)
    .sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0) || `${a.title}`.localeCompare(b.title))
    .slice(0, 5)
    .map(stripResolvedItem);
  const topStaleItems = [...projectItems]
    .filter((item) => item.stale)
    .sort((a, b) => {
      const left = a.lastUsedAt ?? a.createdAt;
      const right = b.lastUsedAt ?? b.createdAt;
      return left.localeCompare(right) || a.title.localeCompare(b.title);
    })
    .slice(0, 5)
    .map(stripResolvedItem);

  return {
    projectSlug,
    projectName: getProjectLabel(projectSlug),
    itemCount,
    memoryCount,
    artifactCount,
    runCount: traceMetas.length,
    knowledgeBackedRunCount,
    recentlyUsedCount,
    staleCount,
    feedback: summary,
    nextModeDistribution: buildNextModeBuckets(traceMetas, projectSlug),
    topReusedItems,
    topStaleItems,
    retentionNote: `based on retained ${snapshot.eventWindow.retainedDays}-day history`,
  };
}

function stripResolvedItem(item: KnowledgeHealthResolvedItem): KnowledgeHealthItem {
  return {
    id: item.id,
    sourceId: item.sourceId,
    type: item.type,
    projectSlug: item.projectSlug,
    title: item.title,
    summary: item.summary,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    lastUsedAt: item.lastUsedAt,
    useCount: item.useCount,
    positiveFeedbackCount: item.positiveFeedbackCount,
    negativeFeedbackCount: item.negativeFeedbackCount,
    artifactInfluenceCount: item.artifactInfluenceCount,
    recommendationInfluenceCount: item.recommendationInfluenceCount,
    evidenceRefCount: item.evidenceRefCount,
    stale: item.stale,
    attributionQuality: item.attributionQuality,
  };
}

function buildProjectSummaries(
  items: KnowledgeHealthResolvedItem[],
  snapshot: KnowledgeHealthSnapshot
): KnowledgeHealthProjectSummary[] {
  const projectKeys = uniqueStrings([
    ...items.map((item) => item.projectSlug),
    ...[...snapshot.traceMeta.values()].map((meta) => meta.projectSlug),
  ]) as string[];
  const hasGlobal =
    items.some((item) => item.projectSlug === null) ||
    [...snapshot.traceMeta.values()].some((meta) => meta.projectSlug === null);
  const keys: KnowledgeHealthProjectKey[] = [...projectKeys];
  if (hasGlobal) keys.unshift(null);

  return keys.map((projectSlug) => summarizeItemsForProject(items, snapshot, projectSlug));
}

function buildSummary(snapshot: KnowledgeHealthSnapshot): KnowledgeHealthSummary {
  const items = buildResolvedItems(snapshot);
  const traceMetas = [...snapshot.traceMeta.values()];
  const feedback = emptyRunFeedbackSummary();

  for (const meta of traceMetas) {
    incrementFeedback(feedback, meta.knowledgeBacked, meta.feedbackRating);
  }

  const topReusedItems = [...items]
    .filter((item) => (item.useCount ?? 0) > 0)
    .sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0) || a.title.localeCompare(b.title))
    .slice(0, 10)
    .map(stripResolvedItem);
  const topStaleItems = [...items]
    .filter((item) => item.stale)
    .sort((a, b) => {
      const left = a.lastUsedAt ?? a.createdAt;
      const right = b.lastUsedAt ?? b.createdAt;
      return left.localeCompare(right) || a.title.localeCompare(b.title);
    })
    .slice(0, 10)
    .map(stripResolvedItem);

  return {
    window: {
      startAt: snapshot.eventWindow.startAt,
      endAt: snapshot.eventWindow.endAt,
      basedOnRetainedHistory: true,
      retainedDays: snapshot.eventWindow.retainedDays,
    },
    totals: {
      memoryCount: snapshot.memories.length,
      artifactCount: snapshot.artifacts.length,
      itemCount: items.length,
      runCount: traceMetas.length,
      knowledgeBackedRunCount: traceMetas.filter((meta) => meta.knowledgeBacked).length,
      recentlyUsedCount: items.filter((item) => item.lastUsedAt && !item.stale).length,
      staleCount: items.filter((item) => item.stale).length,
    },
    feedback,
    nextModeDistribution: buildNextModeBuckets(traceMetas),
    topReusedItems,
    topStaleItems,
    projects: buildProjectSummaries(items, snapshot),
    retentionNote: `based on retained ${snapshot.eventWindow.retainedDays}-day history`,
  };
}

function matchesFeedbackFilter(
  item: KnowledgeHealthResolvedItem,
  feedback: "all" | "positive" | "negative" | "mixed" | "any"
): boolean {
  if (feedback === "all") return true;
  const hasPositive = (item.positiveFeedbackCount ?? 0) > 0;
  const hasNegative = (item.negativeFeedbackCount ?? 0) > 0;
  if (feedback === "positive") return hasPositive && !hasNegative;
  if (feedback === "negative") return hasNegative && !hasPositive;
  if (feedback === "mixed") return hasPositive && hasNegative;
  return hasPositive || hasNegative;
}

function matchesEvidenceFilter(
  item: KnowledgeHealthResolvedItem,
  evidence: "all" | "present" | "none"
): boolean {
  if (evidence === "present") return item.evidenceRefCount > 0;
  if (evidence === "none") return item.evidenceRefCount === 0;
  return true;
}

function matchesQueryFilter(item: KnowledgeHealthResolvedItem, query: string): boolean {
  if (query.length === 0) return true;
  const haystack = [item.title, item.summary ?? ""].join("\n").toLowerCase();
  return haystack.includes(query);
}

function filterItems(
  items: KnowledgeHealthResolvedItem[],
  filters: {
    project: KnowledgeHealthProjectKey | undefined;
    type: "all" | "memory" | "artifact";
    stale: boolean | "all";
    feedback: "all" | "positive" | "negative" | "mixed" | "any";
    evidence: "all" | "present" | "none";
    query: string | null;
  }
): KnowledgeHealthResolvedItem[] {
  const query = filters.query?.trim().toLowerCase() ?? "";
  return items.filter(
    (item) =>
      (filters.project === undefined || item.projectSlug === filters.project) &&
      (filters.type === "all" || item.type === filters.type) &&
      (filters.stale === "all" || item.stale === filters.stale) &&
      matchesEvidenceFilter(item, filters.evidence) &&
      matchesFeedbackFilter(item, filters.feedback) &&
      matchesQueryFilter(item, query)
  );
}

function collectLinkedArtifacts(
  traceMetas: KnowledgeHealthTraceMeta[],
  sourceId: string,
  snapshot: KnowledgeHealthSnapshot
): KnowledgeHealthLinkedArtifact[] {
  const seen = new Set<string>();
  const result: KnowledgeHealthLinkedArtifact[] = [];
  for (const meta of traceMetas) {
    const entries = [
      ...meta.attachedArtifactIds.map((id) => ({ id, relation: "attachment" as const })),
      ...meta.dependencyArtifactIds.map((id) => ({ id, relation: "dependency" as const })),
      ...meta.savedArtifactIds.map((id) => ({ id, relation: "saved" as const })),
    ];
    for (const entry of entries) {
      if (entry.id === sourceId) continue;
      const artifact = snapshot.artifactById.get(entry.id);
      if (!artifact) continue;
      const key = `${artifact.id}:${entry.relation}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        id: artifact.id,
        projectSlug: artifact.projectSlug,
        title: artifact.title,
        summary: artifact.summary,
        createdAt: artifact.createdAt,
        nextMode: artifact.nextMode,
        nextReason: artifact.nextReason,
        evidenceRefCount: artifact.evidenceRefs.length,
        relations: [entry.relation],
      });
    }
  }
  return result;
}

function buildDetailActions(
  item: KnowledgeHealthResolvedItem,
  traceMetas: KnowledgeHealthTraceMeta[]
): KnowledgeHealthAction[] {
  const actions: KnowledgeHealthAction[] =
    item.type === "memory"
      ? [
          {
            kind: "delete-memory",
            label: "Delete memory",
            method: "DELETE",
            route: API_ROUTES.chatMemory,
            targetId: item.sourceId,
          },
        ]
      : [
          {
            kind: "open-artifact",
            label: "Open artifact",
            method: "GET",
            route: `${API_ROUTES.chatArtifacts}/${item.sourceId}`,
            targetId: item.sourceId,
          },
        ];

  actions.push({
    kind: "open-trace-events",
    label: "Open trace events",
    method: "GET",
    route: `${API_ROUTES.debugEvents}?traceId=${encodeURIComponent(traceMetas[0]?.trace.id ?? item.sourceId)}`,
    targetId: traceMetas[0]?.trace.id ?? item.sourceId,
  });

  return actions;
}

function buildDetailItemRecord(
  item: KnowledgeHealthResolvedItem
): KnowledgeHealthMemoryRecord | KnowledgeHealthArtifactRecord {
  if (item.type === "memory") {
    return {
      type: "memory",
      id: item.sourceId,
      key: (item.item as LlmMemoryRow).key,
      value: (item.item as LlmMemoryRow).value,
      projectSlug: item.projectSlug,
      createdAt: (item.item as LlmMemoryRow).createdAt,
      updatedAt: (item.item as LlmMemoryRow).updatedAt,
    } satisfies KnowledgeHealthMemoryRecord;
  }
  const artifact = item.item as AssistantArtifactRow;
  return {
    type: "artifact",
    id: item.sourceId,
    projectSlug: item.projectSlug,
    mode: artifact.mode,
    title: artifact.title,
    summary: artifact.summary,
    body: artifact.body,
    contentType: artifact.contentType,
    status: artifact.status,
    sourceConversationId: artifact.sourceConversationId,
    createdAt: artifact.createdAt,
    nextMode: artifact.nextMode,
    nextReason: artifact.nextReason,
    evidenceRefs: artifact.evidenceRefs,
  } satisfies KnowledgeHealthArtifactRecord;
}

function buildDetailRecord(
  item: KnowledgeHealthResolvedItem,
  snapshot: KnowledgeHealthSnapshot
): KnowledgeHealthItemDetail {
  const traceMetas = item.traceIds
    .map((traceId) => snapshot.traceMeta.get(traceId))
    .filter((meta): meta is KnowledgeHealthTraceMeta => Boolean(meta));

  const linkedTraces: KnowledgeHealthTraceLink[] = traceMetas.map((meta) => ({
    id: meta.trace.id,
    projectSlug: meta.projectSlug,
    conversationId: meta.trace.conversationId,
    createdAt: meta.trace.createdAt,
    rating: meta.feedbackRating,
    knowledgeBacked: meta.knowledgeBacked,
    nextMode: meta.nextMode,
    evidenceRefCount: meta.evidenceRefs.length,
    relations: [item.type === "memory" ? "memory" : "artifact"],
  }));

  return {
    item: stripResolvedItem(item),
    record: buildDetailItemRecord(item),
    attributionNotes:
      item.type === "memory" && item.attributionQuality === "inferred"
        ? ["Usage metrics are inferred because the recalled key matches multiple stored memories."]
        : ["Usage metrics are based on retained history."],
    linkedTraces,
    linkedArtifacts: collectLinkedArtifacts(traceMetas, item.sourceId, snapshot),
    linkedEvidenceRefs: uniqueEvidenceRefs([
      ...(item.type === "artifact" ? (item.item as AssistantArtifactRow).evidenceRefs : []),
      ...traceMetas.flatMap((meta) => meta.evidenceRefs),
    ]),
    feedback: {
      positive: traceMetas.filter((meta) => meta.feedbackRating === 1).length,
      negative: traceMetas.filter((meta) => meta.feedbackRating === -1).length,
    },
    actions: buildDetailActions(item, traceMetas),
  };
}

function resolveItemFromIdentifier(
  identifier: string,
  items: KnowledgeHealthResolvedItem[]
): KnowledgeHealthResolvedItem | null {
  const parsed = parseItemIdentifier(identifier);
  if (parsed) {
    return items.find((item) => item.type === parsed.type && item.sourceId === parsed.id) ?? null;
  }

  const matches = items.filter((item) => item.sourceId === identifier);
  if (matches.length === 1) return matches[0] ?? null;
  return null;
}

export async function loadKnowledgeHealthSnapshot(
  repo: LlmRepository
): Promise<KnowledgeHealthSnapshot> {
  return loadSnapshot(repo);
}

export async function buildKnowledgeHealthSummary(
  repo: LlmRepository
): Promise<KnowledgeHealthSummaryResponse> {
  const snapshot = await loadSnapshot(repo);
  return { summary: buildSummary(snapshot) };
}

export async function buildKnowledgeHealthItems(
  repo: LlmRepository,
  params: {
    project?: string | null;
    type?: "all" | "memory" | "artifact";
    stale?: boolean | "all";
    feedback?: "all" | "positive" | "negative" | "mixed" | "any";
    evidence?: "all" | "present" | "none";
    query?: string | null;
    page?: number;
    limit?: number;
  } = {}
): Promise<KnowledgeHealthItemsResponse> {
  const snapshot = await loadSnapshot(repo);
  const allItems = buildResolvedItems(snapshot);
  const filteredItems = filterItems(allItems, {
    project: normalizeProjectFilter(params.project),
    type: params.type ?? "all",
    stale: params.stale ?? "all",
    feedback: params.feedback ?? "all",
    evidence: params.evidence ?? "all",
    query: params.query ?? null,
  }).map(stripResolvedItem);

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 25), 100);
  const start = (page - 1) * limit;
  const items = filteredItems.slice(start, start + limit);

  return {
    items,
    page,
    limit,
    total: filteredItems.length,
    hasMore: start + limit < filteredItems.length,
    filters: {
      project: params.project ?? null,
      type: params.type ?? "all",
      stale: params.stale ?? "all",
      feedback: params.feedback ?? "all",
      evidence: params.evidence ?? "all",
      query: params.query ?? null,
    },
  };
}

export async function buildKnowledgeHealthProject(
  repo: LlmRepository,
  project: string
): Promise<KnowledgeHealthProjectResponse> {
  const snapshot = await loadSnapshot(repo);
  const items = buildResolvedItems(snapshot);
  const projectSlug = project === "global" ? null : project;
  return {
    project: summarizeItemsForProject(items, snapshot, projectSlug),
  };
}

export async function buildKnowledgeHealthItemDetail(
  repo: LlmRepository,
  identifier: string
): Promise<KnowledgeHealthItemDetail | null> {
  const snapshot = await loadSnapshot(repo);
  const items = buildResolvedItems(snapshot);
  const item = resolveItemFromIdentifier(identifier, items);
  if (!item) return null;
  return buildDetailRecord(item, snapshot);
}
