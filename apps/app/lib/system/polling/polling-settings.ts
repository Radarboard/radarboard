import "@/lib/polling-config";
import {
  type DashboardPollingPreferences,
  getEffectiveCacheTtlSeconds,
  type PollingSourceId,
  sanitizePollingPreferences,
} from "@radarboard/types/polling";
import { getSettingsRepo } from "@/data/core/repository";

export async function getDashboardPollingPreferences(): Promise<
  DashboardPollingPreferences | undefined
> {
  try {
    const widgetLayout = await getSettingsRepo().getWidgetLayout();
    return sanitizePollingPreferences(widgetLayout?.preferences?.polling);
  } catch {
    return undefined;
  }
}

export function resolvePollingTtlSeconds(
  sourceId: PollingSourceId | undefined,
  fallbackTtlSeconds: number,
  preferences?: DashboardPollingPreferences
): number {
  return sourceId ? getEffectiveCacheTtlSeconds(sourceId, preferences) : fallbackTtlSeconds;
}
