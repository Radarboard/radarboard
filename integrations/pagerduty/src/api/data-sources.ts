/**
 * PagerDuty — Data Sources
 */

import type { DataSourceDescriptor } from "@radarboard/integration-sdk/types";
import type { PagerDutyConfig } from "../types";
import { getActiveIncidents, getOnCalls, getRecentIncidents, getServices } from "./client";

async function resolveConfig(ctx: {
  resolveCredential(key: string): Promise<Record<string, string> | null>;
}): Promise<PagerDutyConfig | null> {
  const creds = await ctx.resolveCredential("pagerduty");
  if (!creds?.apiToken) return null;
  return { apiToken: creds.apiToken };
}

export const pagerdutyIncidentsDataSource: DataSourceDescriptor = {
  action: "data",
  description: "Active and recent incidents from PagerDuty.",
  cacheTtlSeconds: 120,
  async fetch(_params, ctx) {
    const config = await resolveConfig(ctx);
    if (!config) return { configured: false };
    const [active, recent] = await Promise.all([
      getActiveIncidents(config),
      getRecentIncidents(config),
    ]);
    return {
      activeIncidents: active,
      recentIncidents: recent,
      activeCount: active.length,
      triggeredCount: active.filter((i) => i.status === "triggered").length,
      acknowledgedCount: active.filter((i) => i.status === "acknowledged").length,
    };
  },
};

export const pagerdutyServicesDataSource: DataSourceDescriptor = {
  action: "services",
  description: "Service health status from PagerDuty.",
  cacheTtlSeconds: 300,
  async fetch(_params, ctx) {
    const config = await resolveConfig(ctx);
    if (!config) return { configured: false };
    return getServices(config);
  },
};

export const pagerdutyOnCallDataSource: DataSourceDescriptor = {
  action: "oncall",
  description: "Current on-call schedule from PagerDuty.",
  cacheTtlSeconds: 300,
  async fetch(_params, ctx) {
    const config = await resolveConfig(ctx);
    if (!config) return { configured: false };
    return getOnCalls(config);
  },
};

export const pagerdutyDataSources = [
  pagerdutyIncidentsDataSource,
  pagerdutyServicesDataSource,
  pagerdutyOnCallDataSource,
];
