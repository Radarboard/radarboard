"use client";

import type { TimeRange } from "@radarboard/types/dashboard";
import type { ReactElement } from "react";

interface DataSourceResolverState {
  data: unknown;
  fetchedAt: number | null;
  refetch: (() => Promise<void>) | null;
  loading: boolean;
  error: string | null;
}

/** Props passed to a data source resolver component. */
export interface DataSourceResolverProps {
  projectSlug: string | null;
  timeRange?: TimeRange;
  config?: object;
  onState: (state: Partial<DataSourceResolverState>) => void;
}

/** A React component that resolves data for a template data source. */
export type DataSourceResolver = (props: DataSourceResolverProps) => ReactElement | null;

/** Global registry mapping data source IDs to their resolver components. */
export const DATA_SOURCE_REGISTRY = new Map<string, DataSourceResolver>();

/**
 * Register a data source resolver so the template engine can fetch its data.
 *
 * @example
 * ```ts
 * registerTemplateDataSource("my-widget", MyWidgetResolver);
 * ```
 */
export function registerTemplateDataSource(id: string, resolver: DataSourceResolver) {
  DATA_SOURCE_REGISTRY.set(id, resolver);
}

/**
 * Report the current state of a data source resolver to the template engine.
 *
 * Call this from your resolver component whenever data, loading, or error state changes.
 *
 * @example
 * ```ts
 * reportResolverState(onState, {
 *   data: fetchedData,
 *   loading: false,
 *   error: null,
 *   fetchedAt: Date.now() / 1000,
 * });
 * ```
 */
export function reportResolverState(
  onState: (state: Partial<DataSourceResolverState>) => void,
  state: Partial<DataSourceResolverState>
) {
  onState(state);
}
