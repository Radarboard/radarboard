/**
 * Polling source IDs are now open-ended strings — widgets register
 * their own polling sources at boot instead of being hardcoded here.
 */
export type PollingSourceId = string;

export type DashboardPollingPreferences = Partial<Record<string, number>>;

export interface PollingDataSourceRef {
  integration: string;
  action: string;
}

export interface PollingSourceDefinition {
  label: string;
  description?: string;
  category?: "app" | "plugin" | "widget";
  defaultIntervalMs: number;
  allowedIntervalsMs: readonly number[];
  widgetIds: readonly string[];
  dataSources: readonly PollingDataSourceRef[];
}

/**
 * Dynamic polling source registry. Populated at boot by widgets/integrations
 * via `registerPollingSource()`.
 */
export const POLLING_SOURCE_REGISTRY = new Map<string, PollingSourceDefinition>();

/** Register a polling source definition. */
export function registerPollingSource(id: string, definition: PollingSourceDefinition): void {
  POLLING_SOURCE_REGISTRY.set(id, definition);
}

export function isPollingSourceId(value: string): value is PollingSourceId {
  return POLLING_SOURCE_REGISTRY.has(value);
}

export function getPollingSourceDefinition(sourceId: string): PollingSourceDefinition | undefined {
  return POLLING_SOURCE_REGISTRY.get(sourceId);
}

export function getPollingDefaultInterval(sourceId: string): number {
  return getPollingSourceDefinition(sourceId)?.defaultIntervalMs ?? 120_000;
}

export function getPollingAllowedIntervals(sourceId: string): readonly number[] {
  return getPollingSourceDefinition(sourceId)?.allowedIntervalsMs ?? [];
}

export function isAllowedPollingInterval(sourceId: string, intervalMs: number): boolean {
  return getPollingAllowedIntervals(sourceId).includes(intervalMs);
}

export function getEffectivePollingInterval(
  sourceId: string,
  preferences?: DashboardPollingPreferences | null
): number {
  const override = preferences?.[sourceId];
  if (typeof override === "number" && isAllowedPollingInterval(sourceId, override)) {
    return override;
  }
  return getPollingDefaultInterval(sourceId);
}

export function getEffectiveCacheTtlSeconds(
  sourceId: string,
  preferences?: DashboardPollingPreferences | null
): number {
  return Math.floor(getEffectivePollingInterval(sourceId, preferences) / 1000);
}

export function sanitizePollingPreferences(
  value: unknown
): DashboardPollingPreferences | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const normalized: DashboardPollingPreferences = {};

  for (const [rawKey, rawValue] of Object.entries(value)) {
    if (!isPollingSourceId(rawKey)) continue;
    if (typeof rawValue !== "number" || !Number.isInteger(rawValue) || rawValue <= 0) continue;
    if (!isAllowedPollingInterval(rawKey, rawValue)) continue;
    normalized[rawKey] = rawValue;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function isValidPollingPreferences(value: unknown): value is DashboardPollingPreferences {
  if (value === undefined) return true;
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  ) {
    return true;
  }
  return sanitizePollingPreferences(value) !== undefined;
}

export function formatPollingInterval(intervalMs: number): string {
  if (intervalMs < 60_000) return `${intervalMs / 1000}s`;
  if (intervalMs < 3_600_000) return `${intervalMs / 60_000}m`;
  return `${intervalMs / 3_600_000}h`;
}

// Polling sources are registered at boot time in apps/app/lib/polling-config.ts
// rather than being hardcoded here. Import that module as a side effect.
