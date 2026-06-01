"use client";

import type { AnalyticsOverview } from "@radarboard/types/analytics";
import type { AppStoreOverview } from "@radarboard/types/app-store-connect";
import type { TimeRange } from "@radarboard/types/dashboard";
import type { HealthCheck, HealthIncident } from "@radarboard/types/health";
import type { SentryOverview } from "@radarboard/types/sentry";
import type { ShippingItem } from "@radarboard/types/shipping";
import { getWidget } from "@radarboard/widget-engine/widgets/registry";
import type { WidgetChromeHook } from "@radarboard/widget-sdk/widget-types";
import { initializeWidgets } from "@/lib/widgets-init";

export interface WidgetChromeAsyncState {
  configured: boolean;
  fetchedAt: number | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface WidgetChromeAnalyticsState extends WidgetChromeAsyncState {
  data: AnalyticsOverview | null;
}

export interface WidgetChromeAppStoreState extends WidgetChromeAsyncState {
  data: AppStoreOverview | null;
}

export interface WidgetChromeHealthState extends WidgetChromeAsyncState {
  checks: HealthCheck[];
  incidents: HealthIncident[];
}

export interface WidgetChromeSentryState extends WidgetChromeAsyncState {
  data: SentryOverview | null;
}

export interface WidgetChromeShippingState extends WidgetChromeAsyncState {
  items: ShippingItem[];
}

type UseWidgetChromeAnalytics = (
  timeRange?: TimeRange,
  projectSlug?: string | null
) => WidgetChromeAnalyticsState;
type UseWidgetChromeAppStore = (
  projectSlug?: string | null,
  timeRange?: TimeRange
) => WidgetChromeAppStoreState;
type UseWidgetChromeHealth = () => WidgetChromeHealthState;
type UseWidgetChromeSentry = (
  projectSlug?: string | null,
  timeRange?: TimeRange
) => WidgetChromeSentryState;
type UseWidgetChromeShipping = (
  projectSlug?: string | null,
  timeRange?: TimeRange
) => WidgetChromeShippingState;

const EMPTY_HEALTH_CHECKS: HealthCheck[] = [];
const EMPTY_HEALTH_INCIDENTS: HealthIncident[] = [];
const EMPTY_SHIPPING_ITEMS: ShippingItem[] = [];

let widgetsInitialized = false;

function ensureWidgetChromeRuntime() {
  if (widgetsInitialized) return;
  initializeWidgets();
  widgetsInitialized = true;
}

function noopRefetch() {
  return Promise.resolve();
}

function getWidgetChromeHook<THook extends WidgetChromeHook>(
  widgetId: string,
  hookId: string,
  fallback: THook
): THook {
  ensureWidgetChromeRuntime();
  return (getWidget(widgetId)?.chrome?.hooks?.[hookId] as THook | undefined) ?? fallback;
}

function useEmptyAnalytics(): WidgetChromeAnalyticsState {
  return {
    data: null,
    configured: false,
    fetchedAt: null,
    loading: false,
    error: null,
    refetch: noopRefetch,
  };
}

function useEmptyAppStore(): WidgetChromeAppStoreState {
  return {
    data: null,
    configured: false,
    fetchedAt: null,
    loading: false,
    error: null,
    refetch: noopRefetch,
  };
}

function useEmptyHealth(): WidgetChromeHealthState {
  return {
    checks: EMPTY_HEALTH_CHECKS,
    incidents: EMPTY_HEALTH_INCIDENTS,
    configured: false,
    fetchedAt: null,
    loading: false,
    error: null,
    refetch: noopRefetch,
  };
}

function useEmptySentry(): WidgetChromeSentryState {
  return {
    data: null,
    configured: false,
    fetchedAt: null,
    loading: false,
    error: null,
    refetch: noopRefetch,
  };
}

function useEmptyShipping(): WidgetChromeShippingState {
  return {
    items: EMPTY_SHIPPING_ITEMS,
    configured: false,
    fetchedAt: null,
    loading: false,
    error: null,
    refetch: noopRefetch,
  };
}

export function useWidgetChromeAnalytics(timeRange: TimeRange, projectSlug: string | null) {
  const useHook = getWidgetChromeHook<UseWidgetChromeAnalytics>(
    "analytics",
    "analytics",
    useEmptyAnalytics
  );
  return useHook(timeRange, projectSlug);
}

export function useWidgetChromeAppStore(projectSlug: string | null, timeRange: TimeRange) {
  const useHook = getWidgetChromeHook<UseWidgetChromeAppStore>(
    "observability",
    "app-store",
    useEmptyAppStore
  );
  return useHook(projectSlug, timeRange);
}

export function useWidgetChromeHealth() {
  const useHook = getWidgetChromeHook<UseWidgetChromeHealth>(
    "observability",
    "health",
    useEmptyHealth
  );
  return useHook();
}

export function useWidgetChromeSentry(projectSlug: string | null, timeRange: TimeRange) {
  const useHook = getWidgetChromeHook<UseWidgetChromeSentry>(
    "observability",
    "sentry",
    useEmptySentry
  );
  return useHook(projectSlug, timeRange);
}

export function useWidgetChromeShipping(projectSlug: string | null, timeRange: TimeRange) {
  const useHook = getWidgetChromeHook<UseWidgetChromeShipping>(
    "shipping",
    "shipping",
    useEmptyShipping
  );
  return useHook(projectSlug, timeRange);
}
