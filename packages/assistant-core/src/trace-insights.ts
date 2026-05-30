import type { LlmTraceRow } from "@radarboard/types/database";

interface TraceInsightRef {
  id: string;
  label: string;
  kind: "artifact" | "note" | "skill";
  badge?: string;
}

interface TraceEvidenceRef {
  kind: "entity" | "page" | "query" | "repo" | "url";
  label: string;
  url?: string;
}

export interface AssistantTraceInsight {
  eventCount: number;
  memoryCount: number;
  attachedSkills: TraceInsightRef[];
  attachedNotes: TraceInsightRef[];
  attachedArtifacts: TraceInsightRef[];
  dependencyArtifacts: TraceInsightRef[];
  toolCount: number;
  toolNames: string[];
  toolSources: string[];
  evidenceRefCount: number;
  evidenceRefs: TraceEvidenceRef[];
  artifactTitle: string | null;
  nextMode: string | null;
  feedbackRating: number | null;
}

export type TraceInsightEvent = {
  traceId: string | null;
  eventType: string;
  projectSlug: string | null;
  conversationId: string | null;
  metadata: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readInsightKind(value: unknown): TraceInsightRef["kind"] {
  return value === "artifact" || value === "note" || value === "skill" ? value : "artifact";
}

function readInsightRefs(value: unknown): TraceInsightRef[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : "",
      label: typeof item.label === "string" ? item.label : "",
      kind: readInsightKind(item.kind),
      badge: typeof item.badge === "string" ? item.badge : undefined,
    }))
    .filter((item) => item.id && item.label);
}

function readEvidenceKind(value: unknown): TraceEvidenceRef["kind"] {
  return value === "entity" ||
    value === "page" ||
    value === "query" ||
    value === "repo" ||
    value === "url"
    ? value
    : "entity";
}

function readEvidenceRefs(value: unknown): TraceEvidenceRef[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => ({
      kind: readEvidenceKind(item.kind),
      label: typeof item.label === "string" ? item.label : "",
      url: typeof item.url === "string" ? item.url : undefined,
    }))
    .filter((item) => item.label);
}

export function buildTraceInsight(
  traces: LlmTraceRow[],
  events: TraceInsightEvent[]
): Array<LlmTraceRow & { insight: AssistantTraceInsight }> {
  const byTraceId = new Map<string, TraceInsightEvent[]>();

  for (const event of events) {
    if (!event.traceId) continue;
    const current = byTraceId.get(event.traceId) ?? [];
    current.push(event);
    byTraceId.set(event.traceId, current);
  }

  return traces.map((trace) => {
    const traceEvents = byTraceId.get(trace.id) ?? [];
    const startedEvent = traceEvents.find((event) => event.eventType === "chat.request.started");
    const contextLoadedEvent = traceEvents.find(
      (event) => event.eventType === "chat.context.loaded"
    );
    const artifactSavedEvent = traceEvents.find(
      (event) => event.eventType === "chat.artifact.saved"
    );
    const feedbackEvent = traceEvents.find((event) => event.eventType === "chat.feedback.recorded");

    const contextRecord = [startedEvent, contextLoadedEvent, artifactSavedEvent]
      .map((event) => event?.metadata?.context)
      .find(isRecord);
    const memoryRecord = [contextLoadedEvent, startedEvent]
      .map((event) => event?.metadata?.memory)
      .find(isRecord);
    const artifactRecord = artifactSavedEvent?.metadata?.artifact;
    const recommendationRecord = artifactSavedEvent?.metadata?.recommendation;
    const feedbackRating =
      typeof feedbackEvent?.metadata?.rating === "number" ? feedbackEvent.metadata.rating : null;
    const toolNames = [
      ...new Set(
        traceEvents
          .filter((event) => event.eventType === "chat.tool.completed")
          .map((event) => event.metadata?.toolName)
          .filter((value): value is string => typeof value === "string")
      ),
    ];
    const toolSources = [
      ...new Set(
        traceEvents
          .filter((event) => event.eventType === "chat.tool.completed")
          .map((event) => event.metadata?.toolSource)
          .filter((value): value is string => typeof value === "string")
      ),
    ];
    const evidenceRefs = [
      ...new Map(
        traceEvents
          .flatMap((event) => {
            if (
              event.eventType === "chat.tool.completed" ||
              event.eventType === "chat.artifact.saved"
            ) {
              return readEvidenceRefs(
                event.metadata?.evidence && isRecord(event.metadata.evidence)
                  ? event.metadata.evidence.refs
                  : []
              );
            }
            return [];
          })
          .map((ref) => [`${ref.kind}:${ref.label}:${ref.url ?? ""}`, ref] as const)
      ).values(),
    ];

    const insight: AssistantTraceInsight = {
      eventCount: traceEvents.length,
      memoryCount: typeof memoryRecord?.count === "number" ? memoryRecord.count : 0,
      attachedSkills: readInsightRefs(contextRecord?.attachedSkills),
      attachedNotes: readInsightRefs(contextRecord?.attachedNotes),
      attachedArtifacts: readInsightRefs(contextRecord?.attachedArtifacts),
      dependencyArtifacts: readInsightRefs(contextRecord?.dependencyArtifacts),
      toolCount: toolNames.length,
      toolNames,
      toolSources,
      evidenceRefCount: evidenceRefs.length,
      evidenceRefs,
      artifactTitle:
        isRecord(artifactRecord) && typeof artifactRecord.title === "string"
          ? artifactRecord.title
          : null,
      nextMode:
        isRecord(recommendationRecord) && typeof recommendationRecord.nextMode === "string"
          ? recommendationRecord.nextMode
          : null,
      feedbackRating,
    };

    return { ...trace, insight };
  });
}
