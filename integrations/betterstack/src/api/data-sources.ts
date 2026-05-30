import type {
  CommonRouteParams,
  DataSourceContext,
  DataSourceDescriptor,
} from "@radarboard/integration-sdk/types";
import { betterstackMonitorDelta } from "../events/delta";
import type { BetterStackConfig } from "../types";
import { getIncidents, getMonitors } from "./client";

type HealthStatus = "up" | "down" | "degraded";

interface HealthCheck {
  id: string;
  name: string;
  url: string;
  status: HealthStatus;
  responseTimeMs: number;
  lastCheckedAt: string;
}

function mapStatus(status: string): HealthStatus {
  switch (status) {
    case "up":
      return "up";
    case "down":
      return "down";
    default:
      return "degraded";
  }
}

function avgResponseTime(responseTimes: { region: string; response_time_ms: number }[]): number {
  if (responseTimes.length === 0) return 0;
  const total = responseTimes.reduce((sum, rt) => sum + rt.response_time_ms, 0);
  return Math.round(total / responseTimes.length);
}

async function resolveConfig(ctx: DataSourceContext): Promise<BetterStackConfig | null> {
  const creds = await ctx.resolveCredential("betterstack");
  if (creds?.apiToken) return { apiToken: creds.apiToken };
  return null;
}

export const betterstackDataSource: DataSourceDescriptor = {
  action: "data",
  description: "Fetches monitor status and incidents from BetterStack Uptime.",
  cacheTtlSeconds: 60,
  pollingSourceId: "health",
  evictPrefixes: ["bs:"],
  buildCacheKey: () => "health",
  async fetch(_params: CommonRouteParams, ctx: DataSourceContext) {
    const config = await resolveConfig(ctx);
    if (!config) {
      return { configured: false as const, checks: [] as HealthCheck[], incidents: [] as never[] };
    }

    const [monitors, incidents] = await Promise.all([
      getMonitors(config),
      getIncidents(config, { limit: 10 }),
    ]);

    const checks: HealthCheck[] = monitors
      .filter((m) => !m.attributes.paused)
      .map((monitor) => ({
        id: monitor.id,
        name: monitor.attributes.pronounceable_name,
        url: monitor.attributes.url,
        status: mapStatus(monitor.attributes.status),
        responseTimeMs: avgResponseTime(monitor.attributes.response_times),
        lastCheckedAt: monitor.attributes.last_checked_at,
      }));

    const activeIncidents = incidents
      .filter((i) => !i.attributes.resolved_at)
      .map((i) => ({
        id: i.id,
        name: i.attributes.name,
        url: i.attributes.url,
        cause: i.attributes.cause,
        startedAt: i.attributes.started_at,
      }));

    return { configured: true as const, checks, incidents: activeIncidents };
  },
  delta: {
    // biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
    extractData: (data: any) => data.checks ?? [],
    detector: betterstackMonitorDelta,
    // biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
    shouldDetect: (data: any) => data.configured !== false && "checks" in data,
  },
};

// biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
export const betterstackDataSources: DataSourceDescriptor<any, any>[] = [betterstackDataSource];
