"use client";

import type { TimeRange } from "@radarboard/types/dashboard";
// Import from local data-sources (not SDK directly) to trigger side-effect registrations.
// data-sources.tsx re-exports the SDK's DATA_SOURCE_REGISTRY and also registers all resolvers.
import { DATA_SOURCE_REGISTRY } from "@radarboard/widget-sdk/data-source-registry";
import { emitWidgetDebugEvent } from "@radarboard/widget-sdk/debug-events";
import type { DataSource, DataSourceDeclaration } from "@radarboard/widget-sdk/types";
import { getByPath } from "@radarboard/widget-sdk/utils/get-by-path";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const NO_ITEM = Symbol("template-no-item");

export interface ResolvedSourceState {
  data: unknown;
  fetchedAt: number | null;
  refetch: (() => Promise<void>) | null;
  loading: boolean;
  error: string | null;
}

type ResolvedDataMap = Record<string, ResolvedSourceState>;

const EMPTY_SOURCE_STATE: ResolvedSourceState = {
  data: null,
  fetchedAt: null,
  refetch: null,
  loading: true,
  error: null,
};

const DataContext = createContext<ResolvedDataMap>({});
const ItemContext = createContext<unknown>(NO_ITEM);

function createSourceState(): ResolvedSourceState {
  return {
    data: null,
    fetchedAt: null,
    refetch: null,
    loading: true,
    error: null,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype
  );
}

function areValuesEquivalent(left: unknown, right: unknown, depth = 4): boolean {
  if (Object.is(left, right)) return true;
  if (depth <= 0) return false;

  if (left == null || right == null) return left === right;

  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime();
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    return left.every((item, index) => areValuesEquivalent(item, right[index], depth - 1));
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every(
      (key) => Object.hasOwn(right, key) && areValuesEquivalent(left[key], right[key], depth - 1)
    );
  }

  return false;
}

function areSourceStatesEquivalent(left: ResolvedSourceState, right: ResolvedSourceState): boolean {
  return (
    left.fetchedAt === right.fetchedAt &&
    left.refetch === right.refetch &&
    left.loading === right.loading &&
    left.error === right.error &&
    areValuesEquivalent(left.data, right.data)
  );
}

function aggregateFetchedAt(sourceIds: string[], resolvedData: ResolvedDataMap): number | null {
  let oldestFetchedAt: number | null = null;

  for (const sourceId of sourceIds) {
    const fetchedAt = resolvedData[sourceId]?.fetchedAt;
    if (fetchedAt == null) continue;
    oldestFetchedAt = oldestFetchedAt == null ? fetchedAt : Math.min(oldestFetchedAt, fetchedAt);
  }

  return oldestFetchedAt;
}

interface RefreshCycleState {
  active: boolean;
  requestId: string | null;
  startedAt: number;
}

interface WidgetRefreshSnapshot {
  anyError: boolean;
  anyLoading: boolean;
  errors: Array<{ sourceId: string; error: string }>;
}

function buildWidgetRefreshSnapshot(
  sourceIds: string[],
  resolvedData: ResolvedDataMap
): WidgetRefreshSnapshot {
  let anyLoading = false;
  const errors: Array<{ sourceId: string; error: string }> = [];

  for (const sourceId of sourceIds) {
    const state = resolvedData[sourceId] ?? EMPTY_SOURCE_STATE;

    if (state.loading) {
      anyLoading = true;
    }

    if (state.error != null) {
      errors.push({ sourceId, error: state.error });
    }
  }

  return {
    anyError: errors.length > 0,
    anyLoading,
    errors,
  };
}

function createRefreshCycleState(requestId: string | null, startedAt: number): RefreshCycleState {
  return {
    active: requestId != null,
    requestId,
    startedAt,
  };
}

function emitWidgetRefreshStarted({
  projectSlug,
  requestId,
  sourceIds,
  timeRange,
  widgetId,
}: {
  projectSlug: string | null;
  requestId: string;
  sourceIds: string[];
  timeRange?: TimeRange;
  widgetId: string;
}) {
  return emitWidgetDebugEvent({
    level: "info",
    source: "widget/refresh",
    eventType: "widget.refresh.started",
    message: "Widget refresh started",
    projectSlug,
    requestId,
    entityType: "widget",
    entityId: widgetId,
    status: "started",
    metadata: { sourceIds, timeRange: timeRange ?? null },
  });
}

function emitWidgetRefreshCompleted({
  cycle,
  projectSlug,
  snapshot,
  sourceIds,
  timeRange,
  widgetId,
}: {
  cycle: RefreshCycleState;
  projectSlug: string | null;
  snapshot: WidgetRefreshSnapshot;
  sourceIds: string[];
  timeRange?: TimeRange;
  widgetId: string;
}) {
  return emitWidgetDebugEvent({
    level: snapshot.anyError ? "error" : "info",
    source: "widget/refresh",
    eventType: snapshot.anyError ? "widget.refresh.failed" : "widget.refresh.completed",
    message: snapshot.anyError ? "Widget refresh failed" : "Widget refresh completed",
    projectSlug,
    requestId: cycle.requestId,
    entityType: "widget",
    entityId: widgetId,
    status: snapshot.anyError ? "failed" : "completed",
    durationMs: Date.now() - cycle.startedAt,
    metadata: {
      sourceIds,
      timeRange: timeRange ?? null,
      errors: snapshot.errors,
    },
  });
}

interface ResolverMountProps {
  sourceId: string;
  projectSlug: string | null;
  timeRange?: TimeRange;
  config?: object;
  onState: (sourceId: string, nextState: Partial<ResolvedSourceState>) => void;
}

function ResolverMount({ sourceId, projectSlug, timeRange, config, onState }: ResolverMountProps) {
  const Resolver = DATA_SOURCE_REGISTRY.get(sourceId);
  const lastReportedStateRef = useRef<ResolvedSourceState>(createSourceState());
  const handleResolverState = useCallback(
    (nextState: Partial<ResolvedSourceState>) => {
      const mergedState = { ...lastReportedStateRef.current, ...nextState };
      if (areSourceStatesEquivalent(lastReportedStateRef.current, mergedState)) {
        return;
      }
      lastReportedStateRef.current = mergedState;
      onState(sourceId, nextState);
    },
    [onState, sourceId]
  );

  useEffect(() => {
    if (!Resolver) {
      handleResolverState({
        loading: false,
        error: `Data source "${sourceId}" is not registered`,
      });
    }
  }, [Resolver, handleResolverState, sourceId]);

  if (!Resolver) return null;

  return (
    <Resolver
      projectSlug={projectSlug}
      timeRange={timeRange}
      config={config}
      onState={handleResolverState}
    />
  );
}

interface DataResolverProviderProps {
  widgetId?: string | null;
  dataSources: DataSourceDeclaration[];
  projectSlug: string | null;
  timeRange?: TimeRange;
  config?: object;
  children: ReactNode;
  onFetchedAt?: (fetchedAt: number | null) => void;
  onRefetch?: (refetch: (() => Promise<void>) | null) => void;
}

export function DataResolverProvider({
  widgetId,
  dataSources,
  projectSlug,
  timeRange,
  config,
  children,
  onFetchedAt,
  onRefetch,
}: DataResolverProviderProps) {
  const sourceIds = useMemo(() => dataSources.map(({ id }) => id), [dataSources]);
  const refreshCycleRef = useRef<RefreshCycleState>(createRefreshCycleState(null, 0));
  const [resolvedData, setResolvedData] = useState<ResolvedDataMap>(() =>
    Object.fromEntries(sourceIds.map((sourceId) => [sourceId, createSourceState()]))
  );

  useEffect(() => {
    setResolvedData((current) => {
      const nextEntries = Object.fromEntries(
        sourceIds.map((sourceId) => [sourceId, current[sourceId] ?? createSourceState()])
      ) as ResolvedDataMap;

      const currentKeys = Object.keys(current);
      const hasSameShape =
        currentKeys.length === sourceIds.length &&
        sourceIds.every((sourceId) => sourceId in current);

      if (hasSameShape) {
        return current;
      }

      return nextEntries;
    });
  }, [sourceIds]);

  const handleSourceState = useCallback(
    (sourceId: string, partialState: Partial<ResolvedSourceState>) => {
      setResolvedData((current) => {
        const previous = current[sourceId] ?? createSourceState();
        const nextState = { ...previous, ...partialState };

        if (areSourceStatesEquivalent(previous, nextState)) {
          return current;
        }

        return {
          ...current,
          [sourceId]: nextState,
        };
      });
    },
    []
  );

  const anyUnconfigured = useMemo(
    () =>
      Object.values(resolvedData).some((s) => {
        if (s.loading) return false;
        if (s.data && typeof s.data === "object") {
          const data = s.data as Record<string, unknown>;
          if (data.configured === false) return true;
        }
        return false;
      }),
    [resolvedData]
  );

  const fetchedAt = useMemo(
    () => (anyUnconfigured ? null : aggregateFetchedAt(sourceIds, resolvedData)),
    [anyUnconfigured, resolvedData, sourceIds]
  );
  const refetchFns = useMemo(
    () =>
      sourceIds
        .map((sourceId) => resolvedData[sourceId]?.refetch)
        .filter((refetch): refetch is () => Promise<void> => refetch != null),
    [resolvedData, sourceIds]
  );
  const refetchFnsRef = useRef<Array<() => Promise<void>>>([]);

  refetchFnsRef.current = refetchFns;

  const runRefetchAll = useCallback(async () => {
    await Promise.all(refetchFnsRef.current.map((refetch) => refetch()));
  }, []);
  const refetchAll = refetchFns.length > 0 ? runRefetchAll : null;

  useEffect(() => {
    onFetchedAt?.(fetchedAt);
  }, [fetchedAt, onFetchedAt]);

  useEffect(() => {
    onRefetch?.(refetchAll);
  }, [onRefetch, refetchAll]);

  useEffect(() => {
    if (!widgetId || sourceIds.length === 0) return;

    const snapshot = buildWidgetRefreshSnapshot(sourceIds, resolvedData);
    const cycle = refreshCycleRef.current;

    if (snapshot.anyLoading) {
      if (cycle.active) return;

      const requestId = crypto.randomUUID();
      refreshCycleRef.current = createRefreshCycleState(requestId, Date.now());
      emitWidgetRefreshStarted({
        projectSlug,
        requestId,
        sourceIds,
        timeRange,
        widgetId,
      }).catch(() => {
        /* fire-and-forget */
      });
      return;
    }

    if (!cycle.active) return;

    refreshCycleRef.current = createRefreshCycleState(null, 0);
    emitWidgetRefreshCompleted({
      cycle,
      projectSlug,
      snapshot,
      sourceIds,
      timeRange,
      widgetId,
    }).catch(() => {
      /* fire-and-forget */
    });
  }, [projectSlug, resolvedData, sourceIds, timeRange, widgetId]);

  return (
    <DataContext.Provider value={resolvedData}>
      {dataSources.map(({ id }) => (
        <ResolverMount
          key={id}
          sourceId={id}
          projectSlug={projectSlug}
          timeRange={timeRange}
          config={config}
          onState={handleSourceState}
        />
      ))}
      {children}
    </DataContext.Provider>
  );
}

export function TemplateItemProvider({ item, children }: { item: unknown; children: ReactNode }) {
  return <ItemContext.Provider value={item}>{children}</ItemContext.Provider>;
}

export function useResolvedData(
  source: DataSource | undefined,
  options?: {
    disableItemContext?: boolean;
    item?: unknown;
  }
): unknown {
  const resolvedData = useContext(DataContext);
  const itemContext = useContext(ItemContext);
  if (!source) return undefined;

  const item = options && "item" in options ? options.item : itemContext;
  if (!options?.disableItemContext && item !== NO_ITEM) {
    const itemValue = getByPath(item, source.field);
    if (itemValue !== undefined) {
      return itemValue;
    }
  }

  return getByPath(resolvedData[source.sourceId]?.data, source.field);
}

export function useResolvedSourceState(sourceId: string | undefined): ResolvedSourceState {
  const resolvedData = useContext(DataContext);
  if (!sourceId) return EMPTY_SOURCE_STATE;
  return resolvedData[sourceId] ?? EMPTY_SOURCE_STATE;
}

export function useResolvedSourceData(sourceId: string | undefined): unknown {
  return useResolvedSourceState(sourceId).data;
}

/**
 * Returns true while any registered data source is still loading.
 * Used by SkeletonShimmer to show the shimmer overlay until all data is ready.
 */
export function useAllSourcesLoading(): boolean {
  const resolvedData = useContext(DataContext);
  const entries = Object.values(resolvedData);
  if (entries.length === 0) return false;
  return entries.some((s) => s.loading);
}

/**
 * Returns true if any data source is unconfigured.
 * Detects three patterns:
 *   1. Response includes `{ configured: false }`
 *   2. Response is null/undefined after loading (404 or failed fetch)
 *   3. Response has an error and no data
 * Used by TemplateWidget to show a "Connect" CTA instead of empty data.
 */
export function useAnySourceUnconfigured(): boolean {
  const resolvedData = useContext(DataContext);
  return Object.values(resolvedData).some((s) => {
    if (s.loading) return false;
    // Explicit configured: false flag from integration
    if (s.data && typeof s.data === "object") {
      const data = s.data as Record<string, unknown>;
      if (data.configured === false) return true;
    }
    // No data or error after loading finished (404, 500, or empty response)
    if (!s.data || s.error) return true;
    return false;
  });
}
