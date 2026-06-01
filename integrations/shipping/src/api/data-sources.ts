/**
 * Provider-neutral shipping data source.
 *
 * Concrete shipping signals such as merged pull requests, closed issues, and
 * deployments are contributed by community provider extensions. Core keeps the
 * stable data-source contract so dashboards and demo mode can boot with no
 * provider integrations installed.
 */

import type { DataSourceDescriptor } from "@radarboard/integration-sdk/types";

interface ShippingParams {
  limit: number;
}

export const shippingDataSource: DataSourceDescriptor<ShippingParams> = {
  action: "data",
  description: "Returns recent shipping activity contributed by installed provider extensions.",
  cacheTtlSeconds: 120,
  pollingSourceId: "shipping",
  parseParams: (sp) => ({ limit: Number(sp.get("limit") ?? "20") }),
  buildCacheKey: (params) =>
    `shipping:${params.projectSlug ?? "all"}:${params.range}:${params.timeZone}`,
  async fetch() {
    return {
      configured: false,
      items: [],
      setupMessage: "Install a shipping provider extension to show release activity.",
      ctaLabel: "Install extension",
      ctaTarget: "/settings?section=integrations",
    };
  },
};

// biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
export const shippingDataSources: DataSourceDescriptor<any, any>[] = [shippingDataSource];
