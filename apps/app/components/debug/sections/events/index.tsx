"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import { Button } from "@radarboard/ui/button";
import { EmptyState } from "@radarboard/ui/empty-state";
import { Input } from "@radarboard/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@radarboard/ui/select";
import { cn } from "@radarboard/utils/cn";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  DebugBadge,
  DebugSection,
  formatMs,
  LoadingState,
  relativeTime,
  StatStrip,
} from "../../shared";
import { EventsTimeline, type TimelineBucket } from "../events-timeline";
import {
  buildEventListRows,
  type DebugEvent,
  durationBadgeVariant,
  type EventLevel,
} from "../events-utils";

type EventsPreset =
  | "all"
  | "client-issues"
  | "widget-failures"
  | "promoted-alerts"
  | "assistant-feedback";

const LEVEL_OPTIONS: Array<"all" | EventLevel> = ["all", "debug", "info", "warn", "error"];

const LEVEL_CLASS: Record<EventLevel, string> = {
  debug: "text-dim",
  info: "text-accent",
  warn: "text-warning",
  error: "text-destructive",
};

const STATUS_TONE: Record<
  string,
  "default" | "accent" | "muted" | "error" | "warning" | "success"
> = {
  started: "muted",
  completed: "success",
  failed: "error",
  rejected: "error",
};

const PRESET_OPTIONS: Array<{ id: EventsPreset; label: string }> = [
  { id: "all", label: "All" },
  { id: "client-issues", label: "Client Issues" },
  { id: "widget-failures", label: "Widget Failures" },
  { id: "promoted-alerts", label: "Promoted Alerts" },
  { id: "assistant-feedback", label: "Assistant Feedback" },
];

interface ContextRef {
  id: string;
  label: string;
  kind: "artifact" | "note" | "skill";
  badge?: string;
}

interface ContextMetadata {
  counts: {
    attachedSkills: number;
    attachedArtifacts: number;
    attachedNotes: number;
    dependencyArtifacts: number;
  };
  attachedSkills: ContextRef[];
  attachedArtifacts: ContextRef[];
  attachedNotes: ContextRef[];
  dependencyArtifacts: ContextRef[];
}

interface ArtifactMetadata {
  id: string;
  title: string;
  mode: string;
  status: string;
}

interface RecommendationMetadata {
  nextMode: string | null;
  nextReason: string | null;
  recentErrorCount?: number;
  recentShippingCount?: number;
}

interface ToolMetadata {
  toolName: string;
  toolSource: string | null;
  namespace: string | null;
  result?: Record<string, unknown>;
  evidenceRefs?: Array<{
    kind: "entity" | "page" | "query" | "repo" | "url";
    label: string;
    url?: string;
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readContextRefKind(value: unknown): ContextRef["kind"] {
  return value === "artifact" || value === "note" || value === "skill" ? value : "artifact";
}

function readContextRefs(value: unknown): ContextRef[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : "",
      label: typeof item.label === "string" ? item.label : "",
      kind: readContextRefKind(item.kind),
      badge: typeof item.badge === "string" ? item.badge : undefined,
    }))
    .filter((item) => item.id && item.label);
}

function readEvidenceRefKind(
  value: unknown
): NonNullable<ToolMetadata["evidenceRefs"]>[number]["kind"] {
  return value === "entity" ||
    value === "page" ||
    value === "query" ||
    value === "repo" ||
    value === "url"
    ? value
    : "entity";
}

function readEvidenceRefs(value: unknown): NonNullable<ToolMetadata["evidenceRefs"]> {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((item) => ({
      kind: readEvidenceRefKind(item.kind),
      label: typeof item.label === "string" ? item.label : "",
      url: typeof item.url === "string" ? item.url : undefined,
    }))
    .filter((item) => item.label);
}

function readContextMetadata(metadata: Record<string, unknown>): ContextMetadata | null {
  const raw = metadata.context;
  if (!isRecord(raw)) return null;

  const counts = isRecord(raw.counts)
    ? {
        attachedSkills:
          typeof raw.counts.attachedSkills === "number" ? raw.counts.attachedSkills : 0,
        attachedArtifacts:
          typeof raw.counts.attachedArtifacts === "number" ? raw.counts.attachedArtifacts : 0,
        attachedNotes: typeof raw.counts.attachedNotes === "number" ? raw.counts.attachedNotes : 0,
        dependencyArtifacts:
          typeof raw.counts.dependencyArtifacts === "number" ? raw.counts.dependencyArtifacts : 0,
      }
    : {
        attachedSkills: 0,
        attachedArtifacts: 0,
        attachedNotes: 0,
        dependencyArtifacts: 0,
      };

  return {
    counts,
    attachedSkills: readContextRefs(raw.attachedSkills),
    attachedArtifacts: readContextRefs(raw.attachedArtifacts),
    attachedNotes: readContextRefs(raw.attachedNotes),
    dependencyArtifacts: readContextRefs(raw.dependencyArtifacts),
  };
}

function readArtifactMetadata(metadata: Record<string, unknown>): ArtifactMetadata | null {
  const raw = metadata.artifact;
  if (!isRecord(raw)) return null;
  if (
    typeof raw.id !== "string" ||
    typeof raw.title !== "string" ||
    typeof raw.mode !== "string" ||
    typeof raw.status !== "string"
  ) {
    return null;
  }

  return {
    id: raw.id,
    title: raw.title,
    mode: raw.mode,
    status: raw.status,
  };
}

function readRecommendationMetadata(
  metadata: Record<string, unknown>
): RecommendationMetadata | null {
  const raw = metadata.recommendation;
  if (!isRecord(raw)) return null;

  return {
    nextMode: typeof raw.nextMode === "string" ? raw.nextMode : null,
    nextReason: typeof raw.nextReason === "string" ? raw.nextReason : null,
    recentErrorCount: typeof raw.recentErrorCount === "number" ? raw.recentErrorCount : undefined,
    recentShippingCount:
      typeof raw.recentShippingCount === "number" ? raw.recentShippingCount : undefined,
  };
}

function readToolMetadata(metadata: Record<string, unknown>): ToolMetadata | null {
  if (typeof metadata.toolName !== "string") return null;
  const evidenceRecord = isRecord(metadata.evidence) ? metadata.evidence : null;
  return {
    toolName: metadata.toolName,
    toolSource: typeof metadata.toolSource === "string" ? metadata.toolSource : null,
    namespace: typeof metadata.namespace === "string" ? metadata.namespace : null,
    result: isRecord(metadata.result) ? metadata.result : undefined,
    evidenceRefs: evidenceRecord ? readEvidenceRefs(evidenceRecord.refs) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Hooks to reduce cognitive complexity
// ---------------------------------------------------------------------------

function useEventsQuery() {
  const [liveParam, setLiveParam] = useQueryState("eventsLive", parseAsString);
  const [levelParam, setLevelParam] = useQueryState("eventsLevel", parseAsString);
  const [sourceParam, setSourceParam] = useQueryState("eventsSource", parseAsString);
  const [searchParam, setSearchParam] = useQueryState("eventsSearch", parseAsString);
  const [eventTypeParam, setEventTypeParam] = useQueryState("eventsType", parseAsString);
  const [presetParam, setPresetParam] = useQueryState("eventsView", parseAsString);
  const [promotedOnlyParam, setPromotedOnlyParam] = useQueryState("eventsPromoted", parseAsString);
  const [groupedParam, setGroupedParam] = useQueryState("eventsGrouped", parseAsString);
  const [fromParam, setFromParam] = useQueryState("eventsFrom", parseAsString);
  const [toParam, setToParam] = useQueryState("eventsTo", parseAsString);
  const [traceParam, setTraceParam] = useQueryState("eventsTrace", parseAsString);
  const [requestParam, setRequestParam] = useQueryState("eventsRequest", parseAsString);
  const [conversationFilterParam, setConversationFilterParam] = useQueryState(
    "eventsConversation",
    parseAsString
  );
  const [selectedEventParam, setSelectedEventParam] = useQueryState(
    "eventsSelected",
    parseAsString
  );
  const [, setActiveTab] = useQueryState("tab", parseAsString);
  const [, setConversationTargetParam] = useQueryState("conversationId", parseAsString);

  const live = liveParam === "1";
  const promotedOnly = promotedOnlyParam === "1";
  const preset = (
    PRESET_OPTIONS.some((option) => option.id === presetParam) ? presetParam : "all"
  ) as EventsPreset;
  const grouped = groupedParam === "1" || (groupedParam == null && preset === "client-issues");
  const level = (
    LEVEL_OPTIONS.includes((levelParam as "all" | EventLevel) ?? "all")
      ? ((levelParam as "all" | EventLevel) ?? "all")
      : "all"
  ) as "all" | EventLevel;
  const source = sourceParam ?? "";
  const search = searchParam ?? "";
  const eventType = eventTypeParam ?? "";

  return {
    live,
    setLiveParam,
    promotedOnly,
    setPromotedOnlyParam,
    preset,
    setPresetParam,
    grouped,
    setGroupedParam,
    level,
    setLevelParam,
    source,
    setSourceParam,
    search,
    setSearchParam,
    eventType,
    setEventTypeParam,
    fromParam,
    setFromParam,
    toParam,
    setToParam,
    traceParam,
    setTraceParam,
    requestParam,
    setRequestParam,
    conversationFilterParam,
    setConversationFilterParam,
    selectedEventParam,
    setSelectedEventParam,
    setActiveTab,
    setConversationTargetParam,
  };
}

const FILTER_BADGE_CLASS = "uppercase-none h-auto px-2 py-1 text-dim hover:text-foreground";

function FilterBadge({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClear}
      className={FILTER_BADGE_CLASS}
    >
      {label} ×
    </Button>
  );
}

function fire(promise: Promise<unknown>) {
  promise.catch(() => {
    /* fire-and-forget */
  });
}

function ActiveFilterBadges({ query }: { query: ReturnType<typeof useEventsQuery> }) {
  const hasFilters =
    query.level !== "all" ||
    query.source.length > 0 ||
    query.search.length > 0 ||
    query.eventType.length > 0 ||
    query.promotedOnly ||
    query.grouped ||
    query.fromParam ||
    query.toParam ||
    query.traceParam ||
    query.requestParam ||
    query.conversationFilterParam;

  if (!hasFilters) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2 font-mono text-w-sm">
      {query.level !== "all" && (
        <FilterBadge
          label={`level:${query.level}`}
          onClear={() => fire(query.setLevelParam(null))}
        />
      )}
      {query.source.length > 0 && (
        <FilterBadge
          label={`source:${query.source}`}
          onClear={() => fire(query.setSourceParam(null))}
        />
      )}
      {query.search.length > 0 && (
        <FilterBadge
          label={`search:${query.search}`}
          onClear={() => fire(query.setSearchParam(null))}
        />
      )}
      {query.eventType.length > 0 && (
        <FilterBadge
          label={`type:${query.eventType}`}
          onClear={() => fire(query.setEventTypeParam(null))}
        />
      )}
      {Boolean(query.promotedOnly) && (
        <FilterBadge label="promoted" onClear={() => fire(query.setPromotedOnlyParam(null))} />
      )}
      {Boolean(query.grouped) && (
        <FilterBadge label="grouped" onClear={() => fire(query.setGroupedParam(null))} />
      )}
      {Boolean(query.fromParam || query.toParam) && (
        <FilterBadge
          label="time window"
          onClear={() => {
            fire(query.setFromParam(null));
            fire(query.setToParam(null));
          }}
        />
      )}
      {Boolean(query.traceParam) && (
        <FilterBadge
          label={`trace:${query.traceParam}`}
          onClear={() => fire(query.setTraceParam(null))}
        />
      )}
      {Boolean(query.requestParam) && (
        <FilterBadge
          label={`request:${query.requestParam}`}
          onClear={() => fire(query.setRequestParam(null))}
        />
      )}
      {Boolean(query.conversationFilterParam) && (
        <FilterBadge
          label={`chat:${query.conversationFilterParam}`}
          onClear={() => fire(query.setConversationFilterParam(null))}
        />
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          for (const setter of [
            query.setLevelParam,
            query.setSourceParam,
            query.setSearchParam,
            query.setEventTypeParam,
            query.setGroupedParam,
            query.setFromParam,
            query.setTraceParam,
            query.setRequestParam,
            query.setToParam,
            query.setConversationFilterParam,
          ]) {
            fire(setter(null));
          }
        }}
        className="uppercase-none h-auto px-2 py-1 text-accent hover:bg-accent/10 hover:text-accent"
      >
        clear all
      </Button>
    </div>
  );
}

interface PresetParams {
  level: string | null;
  source: string | null;
  search: string | null;
  eventType: string | null;
  grouped: string | null;
  promoted: string | null;
  clearTimeWindow: boolean;
}

function resolvePresetParams(preset: EventsPreset): PresetParams {
  const defaults: PresetParams = {
    level: null,
    source: null,
    search: null,
    eventType: null,
    grouped: null,
    promoted: null,
    clearTimeWindow: false,
  };
  if (preset === "client-issues") {
    return { ...defaults, level: "error", search: "client/", grouped: "1", clearTimeWindow: true };
  }
  if (preset === "widget-failures") {
    return { ...defaults, level: "error", search: "widget.", grouped: "1" };
  }
  if (preset === "promoted-alerts") {
    return { ...defaults, promoted: "1" };
  }
  if (preset === "assistant-feedback") {
    return { ...defaults, source: "api/chat/feedback" };
  }
  return defaults;
}

function handleHotkeyAction(event: KeyboardEvent, action: () => void) {
  if (isEditableTarget(event.target)) return;
  event.preventDefault();
  action();
}

async function fetchPollingEvents(url: string) {
  const res = await fetch(url);
  return (await res.json()) as { events?: DebugEvent[] };
}

function useLivePolling({
  enabled,
  newestOccurredAt,
  buildParams,
  scrollRef,
  setEvents,
  setPendingEvents,
  prependUniqueEvents,
}: {
  enabled: boolean;
  newestOccurredAt: string | null;
  buildParams: (before?: string | null, after?: string | null) => URLSearchParams;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  setEvents: React.Dispatch<React.SetStateAction<DebugEvent[]>>;
  setPendingEvents: React.Dispatch<React.SetStateAction<DebugEvent[]>>;
  prependUniqueEvents: (current: DebugEvent[], incoming: DebugEvent[]) => DebugEvent[];
}) {
  const pollFn = useCallback(async () => {
    if (!newestOccurredAt) return;
    const data = await fetchPollingEvents(
      `/api/debug/events?${buildParams(null, newestOccurredAt).toString()}`
    );
    const freshEvents = data.events ?? [];
    if (freshEvents.length === 0) return;

    const nearTop = (scrollRef.current?.scrollTop ?? 0) < 24;
    if (nearTop) {
      setEvents((current) => prependUniqueEvents(current, freshEvents));
      scrollRef.current?.scrollTo({ top: 0 });
    } else {
      setPendingEvents((current) => prependUniqueEvents(current, freshEvents));
    }
  }, [buildParams, newestOccurredAt, prependUniqueEvents, scrollRef, setEvents, setPendingEvents]);

  const pollFnRef = useRef(pollFn);
  pollFnRef.current = pollFn;

  useEffect(() => {
    if (!enabled || !newestOccurredAt) return;

    const interval = window.setInterval(() => {
      pollFnRef.current().catch(() => {
        /* fire-and-forget */
      });
    }, 5000);

    return () => window.clearInterval(interval);
  }, [enabled, newestOccurredAt]);
}

function useEventsKeyboardShortcuts(
  focusSearch: () => void,
  query: ReturnType<typeof useEventsQuery>
) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;
      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        focusSearch();
      }
      if (event.key === "l" || event.key === "L") {
        event.preventDefault();
        fire(query.setLiveParam(query.live ? null : "1"));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusSearch, query]);
}

function useEventsDataLoader(
  query: ReturnType<typeof useEventsQuery>,
  scrollRef: React.RefObject<HTMLDivElement | null>
) {
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [pendingEvents, setPendingEvents] = useState<DebugEvent[]>([]);

  const applyQueryFilters = useCallback(
    (params: URLSearchParams) => {
      const conditionalParams: Array<[string, string | null | undefined]> = [
        ["level", query.level !== "all" ? query.level : null],
        ["source", query.source.trim() || null],
        ["search", query.search.trim() || null],
        ["eventType", query.eventType.trim() || null],
        ["traceId", query.traceParam],
        ["requestId", query.requestParam],
        ["conversationId", query.conversationFilterParam],
      ];
      for (const [key, value] of conditionalParams) {
        if (value) params.set(key, value);
      }
    },
    [
      query.level,
      query.source,
      query.search,
      query.eventType,
      query.traceParam,
      query.requestParam,
      query.conversationFilterParam,
    ]
  );

  const buildParams = useCallback(
    (before?: string | null, after?: string | null) => {
      const params = new URLSearchParams({ limit: "200" });
      applyQueryFilters(params);
      if (query.fromParam) params.set("after", query.fromParam);
      if (query.toParam) params.set("before", query.toParam);
      if (before) params.set("before", before);
      if (after) params.set("after", after);
      return params;
    },
    [applyQueryFilters, query.fromParam, query.toParam]
  );

  const buildTimelineParams = useCallback(() => {
    const params = new URLSearchParams({ limit: "2000", buckets: "60" });
    applyQueryFilters(params);
    return params;
  }, [applyQueryFilters]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${API_ROUTES.debugEvents}?${buildParams().toString()}`);
    const data = (await res.json()) as { events?: DebugEvent[]; nextBefore?: string | null };
    setEvents(data.events ?? []);
    setNextBefore(data.nextBefore ?? null);
    scrollRef.current?.scrollTo({ top: 0 });
    setLoading(false);
  }, [buildParams, scrollRef]);

  const loadMore = useCallback(async () => {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    const res = await fetch(`${API_ROUTES.debugEvents}?${buildParams(nextBefore).toString()}`);
    const data = (await res.json()) as { events?: DebugEvent[]; nextBefore?: string | null };
    setEvents((current) => {
      const existingIds = new Set(current.map((event) => event.id));
      const next = (data.events ?? []).filter((event) => !existingIds.has(event.id));
      return [...current, ...next];
    });
    setNextBefore(data.nextBefore ?? null);
    setLoadingMore(false);
  }, [buildParams, loadingMore, nextBefore]);

  useEffect(() => {
    load().catch(() => {
      /* fire-and-forget */
    });
  }, [load]);

  const timelineKey = `/api/debug/events/timeline?${buildTimelineParams().toString()}`;

  const { data: timelineData } = useSWR(timelineKey, async (url: string) => {
    const res = await fetch(url);
    return (await res.json()) as { buckets?: TimelineBucket[]; totalEvents?: number };
  });
  const timelineBuckets = timelineData?.buckets ?? [];
  const timelineTotalEvents = timelineData?.totalEvents ?? 0;

  const prependUniqueEvents = useCallback((current: DebugEvent[], incoming: DebugEvent[]) => {
    const existingIds = new Set(current.map((event) => event.id));
    const next = incoming.filter((event) => !existingIds.has(event.id));
    return [...next, ...current];
  }, []);

  const newestOccurredAt = events[0]?.occurredAt ?? null;

  useLivePolling({
    enabled: query.live,
    newestOccurredAt,
    buildParams,
    scrollRef,
    setEvents,
    setPendingEvents,
    prependUniqueEvents,
  });

  return {
    events,
    setEvents,
    loading,
    loadingMore,
    load,
    loadMore,
    nextBefore,
    pendingEvents,
    setPendingEvents,
    prependUniqueEvents,
    timelineBuckets,
    timelineTotalEvents,
  };
}

function useSelectedRowSync(
  listRows: ReturnType<typeof buildEventListRows>,
  query: ReturnType<typeof useEventsQuery>
) {
  useEffect(() => {
    if (listRows.length === 0) {
      fire(query.setSelectedEventParam(null));
      return;
    }
    const currentSelected = query.selectedEventParam;
    const hasMatch =
      currentSelected &&
      listRows.some(
        (row) => row.event.id === currentSelected || row.relatedIds.includes(currentSelected)
      );
    if (!hasMatch) {
      fire(query.setSelectedEventParam(listRows[0]?.event.id ?? null));
    }
  }, [listRows, query]);
}

function useApplyPreset(query: ReturnType<typeof useEventsQuery>) {
  return useCallback(
    (nextPreset: EventsPreset) => {
      fire(query.setPresetParam(nextPreset === "all" ? null : nextPreset));
      const presetParams = resolvePresetParams(nextPreset);
      fire(query.setLevelParam(presetParams.level));
      fire(query.setSourceParam(presetParams.source));
      fire(query.setSearchParam(presetParams.search));
      fire(query.setEventTypeParam(presetParams.eventType));
      fire(query.setGroupedParam(presetParams.grouped));
      fire(query.setPromotedOnlyParam(presetParams.promoted));
      if (presetParams.clearTimeWindow) {
        fire(query.setFromParam(null));
        fire(query.setToParam(null));
      }
      fire(query.setTraceParam(null));
      fire(query.setRequestParam(null));
      fire(query.setConversationFilterParam(null));
    },
    [query]
  );
}

export function EventsSection() {
  const query = useEventsQuery();
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const {
    events,
    setEvents,
    loading,
    loadingMore,
    load,
    loadMore,
    pendingEvents,
    setPendingEvents,
    prependUniqueEvents,
    nextBefore,
    timelineBuckets,
    timelineTotalEvents,
  } = useEventsDataLoader(query, scrollRef);

  const visibleEvents = useMemo(
    () => (query.promotedOnly ? events.filter((event) => event.promoted) : events),
    [events, query.promotedOnly]
  );

  const listRows = useMemo(
    () => buildEventListRows(visibleEvents, query.grouped),
    [query.grouped, visibleEvents]
  );

  const stats = useMemo(() => {
    const errorCount = visibleEvents.filter((event) => event.level === "error").length;
    const warnCount = visibleEvents.filter((event) => event.level === "warn").length;
    const sources = new Set(visibleEvents.map((event) => event.source)).size;
    const traces = new Set(visibleEvents.map((event) => event.traceId).filter(Boolean)).size;
    return [
      { label: "Events", value: visibleEvents.length.toString() },
      { label: "Errors", value: errorCount.toString() },
      { label: "Warnings", value: warnCount.toString() },
      { label: "Sources", value: sources.toString() },
      { label: "Traces", value: traces.toString() },
    ];
  }, [visibleEvents]);

  const rowVirtualizer = useVirtualizer({
    count: listRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 68,
    overscan: 10,
  });

  const selectedRow =
    listRows.find(
      (row) =>
        row.event.id === query.selectedEventParam ||
        row.relatedIds.includes(query.selectedEventParam ?? "")
    ) ??
    listRows[0] ??
    null;
  const selectedEvent = selectedRow?.event ?? null;

  useSelectedRowSync(listRows, query);

  const selectedIndex = selectedRow ? listRows.findIndex((row) => row.key === selectedRow.key) : -1;

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  const moveSelection = useCallback(
    (direction: -1 | 1) => {
      if (listRows.length === 0) return;
      const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
      const nextIndex = Math.max(0, Math.min(listRows.length - 1, currentIndex + direction));
      const nextRow = listRows[nextIndex];
      if (!nextRow) return;
      query.setSelectedEventParam(nextRow.event.id).catch(() => {
        /* fire-and-forget */
      });
      rowVirtualizer.scrollToIndex(nextIndex, { align: "auto" });
    },
    [listRows, query, rowVirtualizer, selectedIndex]
  );

  useHotkey("ArrowDown", (event) => handleHotkeyAction(event, () => moveSelection(1)));
  useHotkey("ArrowUp", (event) => handleHotkeyAction(event, () => moveSelection(-1)));
  useHotkey("/", (event) => handleHotkeyAction(event, focusSearch));
  useHotkey("Escape", (event) =>
    handleHotkeyAction(event, () => fire(query.setSelectedEventParam(null)))
  );

  useEventsKeyboardShortcuts(focusSearch, query);

  const applyPreset = useApplyPreset(query);

  return (
    <DebugSection className="h-full min-h-0">
      <StatStrip stats={stats} />

      <div className="flex min-h-0 flex-col overflow-hidden rounded-panel border border-border bg-surface">
        <EventsToolbar
          query={query}
          searchInputRef={searchInputRef}
          visibleEventsCount={visibleEvents.length}
          listRowsCount={listRows.length}
          load={load}
          applyPreset={applyPreset}
          timelineBuckets={timelineBuckets}
          timelineTotalEvents={timelineTotalEvents}
        />

        <EventsListPanel
          loading={loading}
          events={events}
          listRows={listRows}
          pendingEvents={pendingEvents}
          scrollRef={scrollRef}
          rowVirtualizer={rowVirtualizer}
          selectedRow={selectedRow}
          query={query}
          setEvents={setEvents}
          setPendingEvents={setPendingEvents}
          prependUniqueEvents={prependUniqueEvents}
          nextBefore={nextBefore}
          loadMore={loadMore}
          loadingMore={loadingMore}
          selectedEvent={selectedEvent}
          router={router}
        />
      </div>
    </DebugSection>
  );
}

function EventsToolbar({
  query,
  searchInputRef,
  visibleEventsCount,
  listRowsCount,
  load,
  applyPreset,
  timelineBuckets,
  timelineTotalEvents,
}: {
  query: ReturnType<typeof useEventsQuery>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  visibleEventsCount: number;
  listRowsCount: number;
  load: () => Promise<void>;
  applyPreset: (preset: EventsPreset) => void;
  timelineBuckets: TimelineBucket[];
  timelineTotalEvents: number;
}) {
  return (
    <div className="sticky top-0 z-10 flex-shrink-0 border-border border-b bg-surface-raised/95 px-4 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={query.level} onValueChange={(v) => fire(query.setLevelParam(v))}>
          <SelectTrigger className="h-9 min-w-[92px]" aria-label="Level">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEVEL_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={query.source}
          onChange={(event) => fire(query.setSourceParam(event.target.value || null))}
          placeholder="Source"
          className="h-9 w-[180px]"
          aria-label="Source"
        />
        <div className="relative min-w-[220px] flex-1">
          <SearchIcon className="icon-xs absolute top-1/2 left-3 -translate-y-1/2 text-dim" />
          <Input
            ref={searchInputRef}
            value={query.search}
            onChange={(event) => fire(query.setSearchParam(event.target.value || null))}
            placeholder="Search events, sources, types, request IDs..."
            className="h-9 w-full pl-9"
            aria-label="Search"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={load}
          className="uppercase-none h-9 px-3 font-mono text-dim text-w-sm transition-colors hover:text-foreground"
        >
          Refresh
        </Button>
        <Button
          type="button"
          variant={query.live ? "default" : "outline"}
          onClick={() => fire(query.setLiveParam(query.live ? null : "1"))}
          className={cn(
            "uppercase-none h-9 px-3 font-mono text-w-sm transition-colors",
            query.live
              ? "border-accent/30 bg-accent/20 text-accent"
              : "text-dim hover:text-foreground"
          )}
        >
          {query.live ? "Live on" : "Live off"}
        </Button>
        <Button
          type="button"
          variant={query.grouped ? "default" : "outline"}
          onClick={() => fire(query.setGroupedParam(query.grouped ? null : "1"))}
          className={cn(
            "uppercase-none h-9 px-3 font-mono text-w-sm transition-colors",
            query.grouped
              ? "border-accent/30 bg-accent/20 text-accent"
              : "text-dim hover:text-foreground"
          )}
        >
          {query.grouped ? "Grouped" : "Group repeats"}
        </Button>
      </div>
      <div className="mt-3 flex items-center justify-between font-mono text-dim text-w-sm">
        <span>
          {visibleEventsCount} events
          {query.grouped ? ` · ${listRowsCount} groups` : ""} (filtered from last 200)
        </span>
        <span>{query.live ? "Polling newer events" : "Inner list scroll only"}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESET_OPTIONS.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant={query.preset === option.id ? "default" : "outline"}
            onClick={() => applyPreset(option.id)}
            className={cn(
              "uppercase-none h-auto px-2.5 py-1 font-mono text-w-sm transition-colors",
              query.preset === option.id
                ? "border-accent/30 bg-accent/20 text-accent"
                : "text-dim hover:text-foreground"
            )}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <div className="mt-3">
        <EventsTimeline
          buckets={timelineBuckets}
          totalEvents={timelineTotalEvents}
          from={query.fromParam}
          to={query.toParam}
          onRangeChange={(from, to) => {
            fire(query.setFromParam(from));
            fire(query.setToParam(to));
          }}
        />
      </div>
      <ActiveFilterBadges query={query} />
    </div>
  );
}

function EventsListPanel({
  loading,
  events,
  listRows,
  pendingEvents,
  scrollRef,
  rowVirtualizer,
  selectedRow,
  query,
  setEvents,
  setPendingEvents,
  prependUniqueEvents,
  nextBefore,
  loadMore,
  loadingMore,
  selectedEvent,
  router,
}: {
  loading: boolean;
  events: DebugEvent[];
  listRows: ReturnType<typeof buildEventListRows>;
  pendingEvents: DebugEvent[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  selectedRow: ReturnType<typeof buildEventListRows>[number] | null;
  query: ReturnType<typeof useEventsQuery>;
  setEvents: React.Dispatch<React.SetStateAction<DebugEvent[]>>;
  setPendingEvents: React.Dispatch<React.SetStateAction<DebugEvent[]>>;
  prependUniqueEvents: (current: DebugEvent[], incoming: DebugEvent[]) => DebugEvent[];
  nextBefore: string | null;
  loadMore: () => Promise<void>;
  loadingMore: boolean;
  selectedEvent: DebugEvent | null;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div className="flex min-h-0 flex-1">
      <div ref={scrollRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {Boolean(loading) && <LoadingState />}
        {!loading && events.length === 0 && <EmptyState message="No debug events yet." />}
        {!loading && events.length > 0 && (
          <div className="flex min-h-full flex-col">
            {pendingEvents.length > 0 && (
              <div className="sticky top-0 z-10 border-border border-b bg-background/95 px-4 py-2 backdrop-blur">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEvents((current) => prependUniqueEvents(current, pendingEvents));
                    setPendingEvents([]);
                    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="uppercase-none h-auto p-0 font-mono text-accent text-w-sm hover:bg-transparent hover:text-accent"
                >
                  Show {pendingEvents.length} new {pendingEvents.length === 1 ? "event" : "events"}
                </Button>
              </div>
            )}
            <div className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = listRows[virtualRow.index];
                if (!row) return null;
                return (
                  <div
                    key={row.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className="absolute top-0 left-0 w-full"
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <EventRow
                      event={row.event}
                      count={row.count}
                      fingerprint={row.fingerprint}
                      selected={selectedRow?.key === row.key}
                      onSelect={() => fire(query.setSelectedEventParam(row.event.id))}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!loading && listRows.length > 0 && (
          <div className="flex items-center justify-center border-secondary border-t px-4 py-3">
            {nextBefore ? (
              <Button
                type="button"
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
                className="uppercase-none h-9 px-3 font-mono text-dim text-w-sm transition-colors hover:text-foreground disabled:opacity-50"
              >
                {loadingMore ? "Loading older…" : "Load older"}
              </Button>
            ) : (
              <span className="font-mono text-dim text-w-sm">Start of history</span>
            )}
          </div>
        )}
      </div>

      <div className="scrollbar-thin hidden w-[520px] overflow-y-auto border-border border-l bg-surface lg:block">
        <EventDetailPane
          event={selectedEvent}
          count={selectedRow?.count ?? 1}
          fingerprint={selectedRow?.fingerprint ?? null}
          onFilterSource={(value) => fire(query.setSourceParam(value))}
          onFilterEventType={(value) => fire(query.setEventTypeParam(value))}
          onFilterTrace={(value) => fire(query.setTraceParam(value))}
          onFilterRequest={(value) => fire(query.setRequestParam(value))}
          onFilterConversation={(value) => fire(query.setConversationFilterParam(value))}
          onOpenConversation={(value) => {
            fire(query.setConversationTargetParam(value));
            fire(query.setActiveTab("conversations"));
          }}
          onOpenNotifications={() => router.push("/?settings=notifications")}
        />
      </div>
    </div>
  );
}

function EventRowContextBadges({ event, selected }: { event: DebugEvent; selected: boolean }) {
  if (
    !event.notificationStatuses?.length &&
    !event.traceId &&
    !event.conversationId &&
    !event.projectSlug
  ) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap justify-end gap-1.5 transition-opacity",
        selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )}
    >
      {event.notificationStatuses?.map((status) => (
        <DebugBadge key={status} variant="muted">
          notify:{status}
        </DebugBadge>
      ))}
      {Boolean(event.traceId) && <DebugBadge variant="muted">trace:{event.traceId}</DebugBadge>}
      {Boolean(event.conversationId) && (
        <DebugBadge variant="muted">chat:{event.conversationId}</DebugBadge>
      )}
      {Boolean(event.projectSlug) && (
        <DebugBadge variant="muted">project:{event.projectSlug}</DebugBadge>
      )}
    </div>
  );
}

function EventRow({
  event,
  count,
  fingerprint,
  selected,
  onSelect,
}: {
  event: DebugEvent;
  count: number;
  fingerprint: string | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const context = readContextMetadata(event.metadata);
  const recommendation = readRecommendationMetadata(event.metadata);
  const contextCount =
    (context?.counts.attachedSkills ?? 0) +
    (context?.counts.attachedArtifacts ?? 0) +
    (context?.counts.attachedNotes ?? 0) +
    (context?.counts.dependencyArtifacts ?? 0);

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onSelect}
      className={cn(
        "group uppercase-none h-auto w-full items-center justify-start rounded-none px-4 py-2 text-left font-sans transition-colors",
        selected ? "bg-accent/10" : "hover:bg-muted"
      )}
    >
      <div className="grid w-full grid-cols-[68px_180px_minmax(0,1fr)_minmax(220px,280px)] items-center gap-4">
        <div className="whitespace-nowrap font-mono text-dim text-w-sm">
          {relativeTime(event.occurredAt)}
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <div className={cn("font-mono text-w-sm", LEVEL_CLASS[event.level])}>{event.level}</div>
            <div className="truncate font-mono text-muted-foreground text-w-sm">{event.source}</div>
          </div>
          <div className="truncate font-mono text-dim text-w-sm">{event.eventType}</div>
        </div>

        <div className="min-w-0">
          <div className="truncate font-mono text-foreground text-w-base">{event.message}</div>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            {Boolean(fingerprint) && <DebugBadge variant="muted">fp:{fingerprint}</DebugBadge>}
            {Boolean(event.entityType) && event.entityId && (
              <DebugBadge variant="muted">
                {event.entityType}:{event.entityId}
              </DebugBadge>
            )}
            {contextCount > 0 && <DebugBadge variant="muted">ctx:{contextCount}</DebugBadge>}
            {Boolean(recommendation?.nextMode) && (
              <DebugBadge variant="accent">next:{recommendation?.nextMode}</DebugBadge>
            )}
            {event.durationMs != null && (
              <DebugBadge variant={durationBadgeVariant(event.durationMs)}>
                {formatMs(event.durationMs)}
              </DebugBadge>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col items-end gap-1">
          <div className="flex flex-wrap justify-end gap-1.5">
            {Boolean(event.status) && (
              <DebugBadge variant={STATUS_TONE[event.status!] ?? "default"}>
                {event.status}
              </DebugBadge>
            )}
            {count > 1 && <DebugBadge variant="accent">{count}x</DebugBadge>}
            {Boolean(event.promoted) && <DebugBadge variant="accent">promoted</DebugBadge>}
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {!event.requestId ? (
              <EventRowContextBadges event={event} selected={selected} />
            ) : (
              <DebugBadge variant="muted">request:{event.requestId}</DebugBadge>
            )}
          </div>
        </div>
      </div>
    </Button>
  );
}

function formatNotifyValue(event: DebugEvent): string {
  if (!event.promoted) return "—";
  const statuses = event.notificationStatuses;
  return statuses?.length ? `promoted (${statuses.join(", ")})` : "promoted";
}

function EventDetailRows({
  event,
  artifact,
  recommendation,
}: {
  event: DebugEvent;
  artifact: ArtifactMetadata | null;
  recommendation: RecommendationMetadata | null;
}) {
  return (
    <div className="space-y-2 font-mono text-w-sm">
      <DetailRow label="Event ID" value={event.id} />
      <DetailRow label="Time" value={new Date(event.occurredAt).toLocaleString()} />
      <DetailRow label="Source" value={event.source} />
      <DetailRow label="Type" value={event.eventType} />
      <DetailRow label="Level" value={event.level} />
      <DetailRow label="Status" value={event.status ?? "—"} />
      <DetailRow label="Project" value={event.projectSlug ?? "—"} />
      <DetailRow
        label="Entity"
        value={event.entityType && event.entityId ? `${event.entityType}:${event.entityId}` : "—"}
      />
      <DetailRow
        label="Artifact"
        value={artifact ? `${artifact.title} (${artifact.mode} · ${artifact.status})` : "—"}
      />
      <DetailRow label="Trace" value={event.traceId ?? "—"} />
      <DetailRow label="Request" value={event.requestId ?? "—"} />
      <DetailRow label="Chat" value={event.conversationId ?? "—"} />
      <DetailRow label="Next" value={recommendation?.nextMode ?? "—"} />
      <DetailRow label="Notify" value={formatNotifyValue(event)} />
    </div>
  );
}

function hasContextLineage(context: ContextMetadata | null): boolean {
  if (!context) return false;
  return (
    context.attachedSkills.length > 0 ||
    context.attachedArtifacts.length > 0 ||
    context.attachedNotes.length > 0 ||
    context.dependencyArtifacts.length > 0
  );
}

function EventMetadataSections({
  context,
  recommendation,
  tool,
}: {
  context: ContextMetadata | null;
  recommendation: RecommendationMetadata | null;
  tool: ToolMetadata | null;
}) {
  return (
    <>
      {hasContextLineage(context) && context && (
        <MetadataSection title="Context Lineage">
          <MetadataReferenceGroup label="Skills" items={context.attachedSkills} />
          <MetadataReferenceGroup label="Notes" items={context.attachedNotes} />
          <MetadataReferenceGroup label="Artifacts" items={context.attachedArtifacts} />
          <MetadataReferenceGroup
            label="Dependency Artifacts"
            items={context.dependencyArtifacts}
          />
        </MetadataSection>
      )}

      {Boolean(recommendation) && (recommendation?.nextMode || recommendation?.nextReason) && (
        <MetadataSection title="Recommendation">
          <DetailRow label="Next mode" value={recommendation?.nextMode ?? "—"} />
          <DetailRow label="Reason" value={recommendation?.nextReason ?? "—"} />
          <DetailRow
            label="Recent errors"
            value={
              typeof recommendation?.recentErrorCount === "number"
                ? recommendation.recentErrorCount.toString()
                : "—"
            }
          />
          <DetailRow
            label="Recent shipping"
            value={
              typeof recommendation?.recentShippingCount === "number"
                ? recommendation.recentShippingCount.toString()
                : "—"
            }
          />
        </MetadataSection>
      )}

      {Boolean(tool) && (
        <MetadataSection title="Tool Activity">
          <DetailRow label="Tool" value={tool?.toolName ?? "—"} />
          <DetailRow label="Source" value={tool?.toolSource ?? "—"} />
          <DetailRow label="Namespace" value={tool?.namespace ?? "—"} />
          {tool?.evidenceRefs && tool?.evidenceRefs.length > 0 && (
            <MetadataReferenceGroup
              label="Evidence"
              items={tool?.evidenceRefs.map((ref) => ({
                id: `${ref.kind}:${ref.label}:${ref.url ?? ""}`,
                label: ref.url ? `${ref.label} → ${ref.url}` : ref.label,
                kind: "artifact" as const,
                badge: ref.kind,
              }))}
            />
          )}
          {Boolean(tool?.result) && (
            <div>
              <div className="mb-2 font-mono text-dim text-w-sm uppercase tracking-widest">
                Result Summary
              </div>
              <pre className="overflow-auto whitespace-pre-wrap break-words rounded-item border border-border bg-secondary/50 px-3 py-3 font-mono text-muted-foreground text-w-sm">
                {JSON.stringify(tool?.result, null, 2)}
              </pre>
            </div>
          )}
        </MetadataSection>
      )}
    </>
  );
}

function EventDetailActions({
  event,
  copied,
  copyValue,
  onFilterSource,
  onFilterEventType,
  onFilterTrace,
  onFilterRequest,
  onFilterConversation,
  onOpenConversation,
  onOpenNotifications,
}: {
  event: DebugEvent;
  copied: string | null;
  copyValue: (label: string, value: string) => void;
  onFilterSource: (value: string) => void;
  onFilterEventType: (value: string) => void;
  onFilterTrace: (value: string) => void;
  onFilterRequest: (value: string) => void;
  onFilterConversation: (value: string) => void;
  onOpenConversation: (value: string) => void;
  onOpenNotifications: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <ActionButton onClick={() => onFilterSource(event.source)}>Filter source</ActionButton>
      <ActionButton onClick={() => onFilterEventType(event.eventType)}>Filter type</ActionButton>
      <ActionButton onClick={() => copyValue("source", event.source)}>
        {copied === "source" ? "Copied source" : "Copy source"}
      </ActionButton>
      {Boolean(event.traceId) && (
        <>
          <ActionButton onClick={() => onFilterTrace(event.traceId ?? "")}>
            Filter trace
          </ActionButton>
          <ActionButton onClick={() => copyValue("trace", event.traceId ?? "")}>
            {copied === "trace" ? "Copied trace" : "Copy trace"}
          </ActionButton>
        </>
      )}
      {Boolean(event.requestId) && (
        <>
          <ActionButton onClick={() => onFilterRequest(event.requestId ?? "")}>
            Filter request
          </ActionButton>
          <ActionButton onClick={() => copyValue("request", event.requestId ?? "")}>
            {copied === "request" ? "Copied request" : "Copy request"}
          </ActionButton>
        </>
      )}
      {Boolean(event.conversationId) && (
        <>
          <ActionButton onClick={() => onFilterConversation(event.conversationId ?? "")}>
            Filter chat
          </ActionButton>
          <ActionButton onClick={() => onOpenConversation(event.conversationId ?? "")}>
            Open chat
          </ActionButton>
          <ActionButton onClick={() => copyValue("chat", event.conversationId ?? "")}>
            {copied === "chat" ? "Copied chat" : "Copy chat"}
          </ActionButton>
        </>
      )}
      <ActionButton onClick={() => copyValue("event", event.id)}>
        {copied === "event" ? "Copied event" : "Copy event ID"}
      </ActionButton>
      {Boolean(event.promoted) && (
        <ActionButton onClick={onOpenNotifications}>Open notifications</ActionButton>
      )}
    </div>
  );
}

function EventDetailPane({
  event,
  count,
  fingerprint,
  onFilterSource,
  onFilterEventType,
  onFilterTrace,
  onFilterRequest,
  onFilterConversation,
  onOpenConversation,
  onOpenNotifications,
}: {
  event: DebugEvent | null;
  count: number;
  fingerprint: string | null;
  onFilterSource: (value: string) => void;
  onFilterEventType: (value: string) => void;
  onFilterTrace: (value: string) => void;
  onFilterRequest: (value: string) => void;
  onFilterConversation: (value: string) => void;
  onOpenConversation: (value: string) => void;
  onOpenNotifications: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyValue = useCallback(async (label: string, value: string) => {
    try {
      const { copyText } = await import("@/lib/clipboard");
      await copyText(value);
      setCopied(label);
      window.setTimeout(() => setCopied((current) => (current === label ? null : current)), 1500);
    } catch {
      // Best-effort only
    }
  }, []);

  if (!event) {
    return (
      <div className="flex h-full items-center justify-center px-6 font-mono text-dim text-w-sm">
        Select an event to inspect its metadata.
      </div>
    );
  }

  const context = readContextMetadata(event.metadata);
  const artifact = readArtifactMetadata(event.metadata);
  const recommendation = readRecommendationMetadata(event.metadata);
  const tool = readToolMetadata(event.metadata);

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="font-mono text-dim text-w-sm uppercase tracking-widest">Event</div>
        <div className="mt-2 font-mono text-foreground-secondary text-w-base leading-relaxed">
          {event.message}
        </div>
        <EventDetailActions
          event={event}
          copied={copied}
          copyValue={copyValue}
          onFilterSource={onFilterSource}
          onFilterEventType={onFilterEventType}
          onFilterTrace={onFilterTrace}
          onFilterRequest={onFilterRequest}
          onFilterConversation={onFilterConversation}
          onOpenConversation={onOpenConversation}
          onOpenNotifications={onOpenNotifications}
        />
        {(count > 1 || fingerprint) && (
          <div className="mt-3 flex flex-wrap gap-2 font-mono text-w-sm">
            {count > 1 && <DebugBadge variant="accent">{count} occurrences in window</DebugBadge>}
            {Boolean(fingerprint) && (
              <DebugBadge variant="muted">fingerprint:{fingerprint}</DebugBadge>
            )}
          </div>
        )}
      </div>

      <EventDetailRows event={event} artifact={artifact} recommendation={recommendation} />

      <EventMetadataSections context={context} recommendation={recommendation} tool={tool} />

      <div>
        <div className="mb-2 font-mono text-dim text-w-sm uppercase tracking-widest">Metadata</div>
        <div className="overflow-hidden rounded-card border border-border bg-background">
          <pre className="scrollbar-thin max-h-[420px] overflow-auto whitespace-pre-wrap break-words px-3 py-3 font-mono text-muted-foreground text-w-sm">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

function MetadataSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 font-mono text-dim text-w-sm uppercase tracking-widest">{title}</div>
      <div className="space-y-2 rounded-card border border-border bg-surface p-3">{children}</div>
    </div>
  );
}

function MetadataReferenceGroup({ label, items }: { label: string; items: ContextRef[] }) {
  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 font-mono text-w-sm">
      <div className="text-dim">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <DebugBadge key={`${item.kind}:${item.id}`} variant="muted">
            {item.label}
            {item.badge ? ` · ${item.badge}` : ""}
          </DebugBadge>
        ))}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[84px_1fr] gap-3">
      <div className="text-dim">{label}</div>
      <div className="break-all text-foreground-secondary">{value}</div>
    </div>
  );
}

function ActionButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className="uppercase-none h-8 rounded-item px-3 font-mono text-dim text-w-sm transition-colors hover:text-foreground"
    >
      {children}
    </Button>
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}
