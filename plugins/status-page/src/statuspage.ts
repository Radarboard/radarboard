import type { PluginUserConfig } from "@radarboard/plugin-sdk/types";
import type { NotificationMetadata, NotificationSeverity } from "@radarboard/types/notifications";
import type { ServiceStatus, StatusSource, StatusSourceKind } from "@radarboard/types/status-page";
import { normalizeStatusSource } from "@radarboard/types/status-page";

export type { StatusSource } from "@radarboard/types/status-page";
export { normalizeStatusSource };

interface StatusPageSummary {
  page?: Record<string, unknown> | null;
  status?: {
    indicator?: string | null;
  } | null;
  components?: Array<{
    status?: string | null;
  }> | null;
}

type FetchLike = typeof fetch;

export const STATUS_PAGE_CONFIG_KEY = "_config";
export const STATUS_PAGE_STANDALONE_SOURCES_KEY = "status:sources";
export const STATUS_PAGE_CACHE_KEY = "status:cache";
export const STATUS_PAGE_PREFERENCES_KEY = "status:preferences";
export const DEFAULT_STATUS_PAGE_REFRESH_INTERVAL_MS = 60_000;
export const STATUS_PAGE_UI_SYNC_INTERVAL_MS = 15_000;
const MIN_STATUS_PAGE_REFRESH_INTERVAL_SECONDS = 15;
const MAX_STATUS_PAGE_REFRESH_INTERVAL_SECONDS = 3600;

export interface StatusPageTransitionNotification {
  source: string;
  sourceEventId: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
}

export interface StatusSourcePreference {
  muted?: boolean;
  disabled?: boolean;
}

export type StatusSourcePreferenceMap = Record<string, StatusSourcePreference>;

function normalizeSourceKind(kind?: StatusSourceKind): StatusSourceKind {
  if (kind === "integration" || kind === "project") return kind;
  return "standalone";
}

function applySourcePreference(
  source: StatusSource,
  preferences?: StatusSourcePreferenceMap
): StatusSource {
  const normalizedSource = normalizeStatusSource(source);
  const preference = preferences?.[normalizedSource.id];
  if (!preference) return normalizedSource;

  const muted = preference.muted ?? normalizedSource.muted ?? false;
  const disabled = preference.disabled ?? normalizedSource.disabled ?? false;

  return {
    ...normalizedSource,
    muted,
    disabled,
    alertsEnabled: normalizedSource.kind === "standalone" ? !muted : undefined,
  };
}

function resolveSourceStatusPageUrl(source: StatusSource): string | null {
  if (source.statusPageUrl?.trim()) return source.statusPageUrl.trim();
  if (normalizeSourceKind(source.kind) === "standalone" && source.url?.trim()) {
    return source.url.trim();
  }
  return null;
}

function canonicalizeStatusPagePath(pathname: string): string {
  const trimmedPath = pathname.replace(/\/+$/, "");
  if (!trimmedPath) return "/api/v2/summary.json";

  const apiMatch = trimmedPath.match(/^(.*)\/api\/v2\/[^/]+\.json$/);
  if (apiMatch) {
    const prefix = apiMatch[1] || "";
    return `${prefix}/api/v2/summary.json`;
  }

  return "/api/v2/summary.json";
}

export function normalizeStatusPageSummaryUrl(input?: string): string | null {
  if (!input?.trim()) return null;

  try {
    const url = new URL(input.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.origin}${canonicalizeStatusPagePath(url.pathname)}`;
  } catch {
    return null;
  }
}

export function mapStatusPageIndicator(indicator?: string | null): ServiceStatus {
  switch ((indicator ?? "").toLowerCase()) {
    case "none":
      return "operational";
    case "minor":
    case "maintenance":
      return "degraded";
    case "major":
    case "critical":
      return "outage";
    default:
      return "unknown";
  }
}

export function mapStatusPageComponentStatus(status?: string | null): ServiceStatus {
  switch ((status ?? "").toLowerCase()) {
    case "operational":
      return "operational";
    case "degraded_performance":
    case "partial_outage":
    case "under_maintenance":
      return "degraded";
    case "major_outage":
      return "outage";
    default:
      return "unknown";
  }
}

function statusLabel(status: ServiceStatus): string {
  switch (status) {
    case "operational":
      return "operational";
    case "degraded":
      return "degraded";
    case "outage":
      return "down";
    default:
      return "unknown";
  }
}

function isStatusPageManagedSource(source: StatusSource): boolean {
  return normalizeStatusPageSummaryUrl(resolveSourceStatusPageUrl(source) ?? undefined) !== null;
}

function alertsEnabledForSource(source: StatusSource): boolean {
  return !source.muted;
}

function isIssueStatus(status: ServiceStatus): boolean {
  return status === "degraded" || status === "outage";
}

function shouldNotifyTransition(previousStatus: ServiceStatus, nextStatus: ServiceStatus): boolean {
  if (previousStatus === nextStatus) return false;
  if (nextStatus === "unknown") return false;
  if (previousStatus === "unknown" && nextStatus === "operational") return false;
  return true;
}

function getNotificationSource(source: StatusSource): string {
  if (source.kind === "project") return "health-check";
  return source.kind === "integration" && source.integrationKey
    ? source.integrationKey
    : "status-page";
}

function getNotificationType(nextStatus: ServiceStatus): string {
  if (nextStatus === "outage") return "status.outage";
  if (nextStatus === "degraded") return "status.degraded";
  return "status.recovered";
}

function getNotificationMetadata(
  source: StatusSource,
  previousStatus: ServiceStatus,
  nextStatus: ServiceStatus
): NotificationMetadata {
  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.url,
    statusPageUrl: source.statusPageUrl ?? null,
    previousStatus,
    currentStatus: nextStatus,
    remoteUpdatedAt: source.remoteUpdatedAt ?? null,
    linkedStatusPage: source.kind === "integration",
    projectHealth: source.kind === "project",
    projectSlug: source.projectSlug ?? null,
    projectName: source.projectName ?? null,
    platformId: source.platformId ?? null,
    platformName: source.platformName ?? null,
    integrationKey: source.integrationKey ?? null,
  };
}

function getTransitionDescriptor(
  sourceName: string,
  previousStatus: ServiceStatus,
  nextStatus: ServiceStatus
): Pick<StatusPageTransitionNotification, "type" | "severity" | "title"> | null {
  if (nextStatus === "outage") {
    return {
      type: "service.outage",
      severity: "critical",
      title: `${sourceName} is down`,
    };
  }

  if (nextStatus === "degraded") {
    return {
      type: "service.degraded",
      severity: "warning",
      title: `${sourceName} is degraded`,
    };
  }

  if (nextStatus === "operational" && isIssueStatus(previousStatus)) {
    return {
      type: "service.recovered",
      severity: "info",
      title: `${sourceName} recovered`,
    };
  }

  return null;
}

function buildTransitionNotification(
  nextSource: StatusSource,
  previousStatus: ServiceStatus,
  nextStatus: ServiceStatus
): StatusPageTransitionNotification | null {
  const descriptor = getTransitionDescriptor(nextSource.name, previousStatus, nextStatus);
  if (!descriptor) return null;

  const sourceEventVersion = nextSource.remoteUpdatedAt ?? `${previousStatus}->${nextStatus}`;
  const eventSource = getNotificationSource(nextSource);

  return {
    source: eventSource,
    sourceEventId: `status-page:${nextSource.id}:${nextStatus}:${sourceEventVersion}`,
    type: getNotificationType(nextStatus),
    severity: descriptor.severity,
    title: descriptor.title,
    body: `Changed from ${statusLabel(previousStatus)} to ${statusLabel(nextStatus)}.`,
    metadata: getNotificationMetadata(nextSource, previousStatus, nextStatus),
  };
}

function mergeStandaloneSourceWithCache(
  source: StatusSource,
  cachedSource: StatusSource | undefined
): StatusSource {
  const normalizedSource = normalizeStatusSource(source);
  if (!cachedSource) return normalizedSource;

  const normalizedCachedSource = normalizeStatusSource(cachedSource);
  return {
    ...normalizedSource,
    status: normalizedCachedSource.status,
    lastCheckedAt: normalizedCachedSource.lastCheckedAt,
    remoteUpdatedAt: normalizedCachedSource.remoteUpdatedAt,
  };
}

function buildLinkedTargetSummary(sources: StatusSource[]): string | null {
  const labels = Array.from(
    new Set(
      sources
        .map((source) => [source.projectName, source.platformName].filter(Boolean).join(" · "))
        .filter(Boolean)
    )
  );

  if (labels.length === 0) return null;
  const preview = labels.slice(0, 2).join(" · ");
  return labels.length > 2 ? `${preview} · +${labels.length - 2} more` : preview;
}

function collapseLinkedIntegrationSources(sources: StatusSource[]): StatusSource[] {
  const groups = new Map<string, StatusSource[]>();

  for (const source of sources.map((entry) => normalizeStatusSource(entry))) {
    const key =
      source.kind === "integration" && source.integrationKey
        ? `integration:${source.integrationKey}`
        : source.id;
    const group = groups.get(key) ?? [];
    group.push(source);
    groups.set(key, group);
  }

  return Array.from(groups.entries()).map(([groupId, group]) => {
    const representative = group[0];
    if (!representative) {
      throw new Error(`Missing representative status source for ${groupId}`);
    }

    return {
      ...representative,
      id: groupId,
      status: getWorstStatus(group.map((source) => source.status)),
      lastCheckedAt:
        group
          .map((source) => source.lastCheckedAt)
          .filter(Boolean)
          .sort()
          .at(-1) ?? representative.lastCheckedAt,
      addedAt:
        group
          .map((source) => source.addedAt)
          .filter(Boolean)
          .sort()
          .at(0) ?? representative.addedAt,
      remoteUpdatedAt:
        group
          .map((source) => source.remoteUpdatedAt)
          .filter((value): value is string => typeof value === "string")
          .sort()
          .at(-1) ?? representative.remoteUpdatedAt,
      projectSlug: null,
      projectName: null,
      platformId: null,
      platformName: null,
      linkedTargetCount: group.length,
      linkedTargetSummary: buildLinkedTargetSummary(group),
    };
  });
}

function getWorstStatus(statuses: ServiceStatus[]): ServiceStatus {
  if (statuses.includes("outage")) return "outage";
  if (statuses.includes("degraded")) return "degraded";
  if (statuses.includes("operational")) return "operational";
  return "unknown";
}

export function getStatusFromStatusPageSummary(summary: StatusPageSummary): ServiceStatus {
  const componentStatuses =
    summary.components?.map((component) => mapStatusPageComponentStatus(component.status)) ?? [];
  const knownComponentStatuses = componentStatuses.filter((status) => status !== "unknown");

  if (knownComponentStatuses.length > 0) {
    return getWorstStatus(knownComponentStatuses);
  }

  return mapStatusPageIndicator(summary.status?.indicator);
}

function getStatusPageUpdatedAt(summary: StatusPageSummary): string | null {
  const updatedAt = summary.page?.updated_at;
  return typeof updatedAt === "string" ? updatedAt : null;
}

export function resolveStatusPageRefreshIntervalMs(config?: PluginUserConfig | null): number {
  const rawValue = config?.settings?.["refresh-interval"];
  const refreshSeconds =
    typeof rawValue === "number" && Number.isFinite(rawValue)
      ? rawValue
      : MIN_STATUS_PAGE_REFRESH_INTERVAL_SECONDS;
  const clampedSeconds = Math.max(
    MIN_STATUS_PAGE_REFRESH_INTERVAL_SECONDS,
    Math.min(MAX_STATUS_PAGE_REFRESH_INTERVAL_SECONDS, Math.round(refreshSeconds))
  );
  return clampedSeconds * 1000;
}

export async function refreshStatusPageSource(
  source: StatusSource,
  fetchImpl: FetchLike = fetch,
  checkedAt = new Date().toISOString()
): Promise<StatusSource> {
  const normalizedSource = normalizeStatusSource(source);
  const summaryUrl = normalizeStatusPageSummaryUrl(
    resolveSourceStatusPageUrl(normalizedSource) ?? undefined
  );
  if (!summaryUrl) return source;

  const response = await fetchImpl(summaryUrl, {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Statuspage request failed with ${response.status}`);
  }

  const summary = (await response.json()) as StatusPageSummary;

  return {
    ...normalizedSource,
    status: getStatusFromStatusPageSummary(summary),
    lastCheckedAt: checkedAt,
    remoteUpdatedAt: getStatusPageUpdatedAt(summary) ?? normalizedSource.remoteUpdatedAt ?? null,
  };
}

async function refreshProjectHealthSource(
  source: StatusSource,
  fetchImpl: FetchLike = fetch
): Promise<StatusSource> {
  const normalizedSource = normalizeStatusSource(source);
  if (!normalizedSource.projectSlug || !normalizedSource.platformId) return normalizedSource;

  const response = await fetchImpl(
    `/api/status-page/project-health?projectSlug=${encodeURIComponent(normalizedSource.projectSlug)}&platformId=${encodeURIComponent(normalizedSource.platformId)}`
  );
  if (!response.ok) {
    throw new Error(`Project health request failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    ok: boolean;
    checkedAt?: string;
  };

  return {
    ...normalizedSource,
    status: data.ok ? "operational" : "outage",
    lastCheckedAt: data.checkedAt ?? new Date().toISOString(),
  };
}

/**
 * Check a simple JSON health endpoint that returns {"status":"ok"}.
 * Used for custom health checks like the webhook relay.
 */
async function refreshJsonHealthSource(
  source: StatusSource,
  fetchImpl: FetchLike = fetch,
  checkedAt = new Date().toISOString()
): Promise<StatusSource> {
  const normalizedSource = normalizeStatusSource(source);
  const healthUrl = normalizedSource.url;
  if (!healthUrl) return normalizedSource;

  const response = await fetchImpl(healthUrl, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    return { ...normalizedSource, status: "outage" as ServiceStatus, lastCheckedAt: checkedAt };
  }

  const data = (await response.json()) as { status?: string };
  const status: ServiceStatus = data.status === "ok" ? "operational" : "degraded";

  return { ...normalizedSource, status, lastCheckedAt: checkedAt };
}

function isJsonHealthSource(source: StatusSource): boolean {
  return source.url?.includes("/api/health") === true;
}

export async function refreshStatusSources(
  sources: StatusSource[],
  fetchImpl: FetchLike = fetch,
  checkedAt = new Date().toISOString()
): Promise<StatusSource[]> {
  if (sources.length === 0) return sources;

  const results = await Promise.allSettled(
    sources.map((source) => {
      const normalizedSource = normalizeStatusSource(source);
      if (normalizedSource.kind === "project") {
        return refreshProjectHealthSource(normalizedSource, fetchImpl);
      }

      if (isJsonHealthSource(normalizedSource)) {
        return refreshJsonHealthSource(normalizedSource, fetchImpl, checkedAt);
      }

      return refreshStatusPageSource(normalizedSource, fetchImpl, checkedAt);
    })
  );

  return results.map((result, index) => {
    const source = sources[index];
    if (!source) {
      throw new Error(`Missing status source at index ${index}`);
    }

    if (result.status === "fulfilled") return result.value;

    const normalizedSource = normalizeStatusSource(source);
    if (normalizedSource.kind === "project") {
      return {
        ...normalizedSource,
        status: "outage",
        lastCheckedAt: checkedAt,
      };
    }

    if (isJsonHealthSource(normalizedSource)) {
      return {
        ...normalizedSource,
        status: "outage",
        lastCheckedAt: checkedAt,
      };
    }

    return normalizeStatusPageSummaryUrl(resolveSourceStatusPageUrl(normalizedSource) ?? undefined)
      ? {
          ...normalizedSource,
          status: "unknown",
          lastCheckedAt: checkedAt,
        }
      : normalizedSource;
  });
}

export function hasStatusPageStatusChanges(
  previous: StatusSource[],
  next: StatusSource[]
): boolean {
  if (previous.length !== next.length) return true;

  const previousById = new Map(previous.map((source) => [source.id, source]));

  for (const source of next) {
    const previousSource = previousById.get(source.id);
    if (!previousSource) return true;
    if (previousSource.status !== source.status) return true;
  }

  return false;
}

export function getStatusPageAlertSources(sources: StatusSource[]): StatusSource[] {
  return collapseLinkedIntegrationSources(sources)
    .map((source) => applySourcePreference(source))
    .filter((source) => !source.disabled && !source.muted)
    .filter((source) => isStatusPageManagedSource(source) && isIssueStatus(source.status))
    .sort((left, right) => {
      if (left.status === right.status) return left.name.localeCompare(right.name);
      return left.status === "outage" ? -1 : 1;
    });
}

export function replaceStandaloneEntriesInCache(
  cachedSources: StatusSource[],
  standaloneSources: StatusSource[]
): StatusSource[] {
  const linkedSources = collapseLinkedIntegrationSources(
    cachedSources.filter((source) => normalizeStatusSource(source).kind === "integration")
  );
  const projectSources = Array.from(
    new Map(
      cachedSources
        .map((source) => normalizeStatusSource(source))
        .filter((source) => source.kind === "project")
        .map((source) => [source.id, source])
    ).values()
  );
  const cachedStandaloneById = new Map(
    cachedSources
      .map((source) => normalizeStatusSource(source))
      .filter((source) => source.kind === "standalone")
      .map((source) => [source.id, source])
  );

  const nextStandaloneSources = standaloneSources.map((source) => {
    const normalizedSource = normalizeStatusSource(source);
    return mergeStandaloneSourceWithCache(
      normalizedSource,
      cachedStandaloneById.get(normalizedSource.id)
    );
  });

  return [...linkedSources, ...projectSources, ...nextStandaloneSources];
}

export function mergeStatusPageSources(
  standaloneSources: StatusSource[],
  cachedSources: StatusSource[],
  preferences: StatusSourcePreferenceMap = {}
): StatusSource[] {
  const normalizedStandaloneSources = standaloneSources.map((source) =>
    normalizeStatusSource(source)
  );
  const normalizedCachedSources = cachedSources.map((source) => normalizeStatusSource(source));

  const mergedStandaloneSources = normalizedStandaloneSources.map((source) => {
    const cachedSource = normalizedCachedSources.find(
      (entry) => entry.kind === "standalone" && entry.id === source.id
    );
    return mergeStandaloneSourceWithCache(source, cachedSource);
  });

  const linkedSources = collapseLinkedIntegrationSources(
    normalizedCachedSources.filter((source) => source.kind === "integration")
  );
  const projectSources = Array.from(
    new Map(
      normalizedCachedSources
        .filter((source) => source.kind === "project")
        .map((source) => [source.id, source])
    ).values()
  );

  return [...projectSources, ...linkedSources, ...mergedStandaloneSources]
    .map((source) => applySourcePreference(source, preferences))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function buildStatusPageTransitionNotifications(
  previous: StatusSource[],
  next: StatusSource[]
): StatusPageTransitionNotification[] {
  const previousById = new Map(previous.map((entry) => [entry.id, normalizeStatusSource(entry)]));
  const notifications: StatusPageTransitionNotification[] = [];

  for (const nextSourceRaw of next) {
    const nextSource = normalizeStatusSource(nextSourceRaw);
    const previousSource = previousById.get(nextSource.id);
    if (!previousSource) continue;
    if (nextSource.disabled || nextSource.muted) continue;
    if (!isStatusPageManagedSource(nextSource) || !alertsEnabledForSource(nextSource)) continue;

    const previousStatus = previousSource.status;
    const nextStatus = nextSource.status;
    if (!shouldNotifyTransition(previousStatus, nextStatus)) continue;

    const notification = buildTransitionNotification(
      {
        ...nextSource,
        remoteUpdatedAt: nextSource.remoteUpdatedAt ?? previousSource.remoteUpdatedAt ?? null,
      },
      previousStatus,
      nextStatus
    );
    if (notification) {
      notifications.push(notification);
    }
  }

  return notifications;
}
